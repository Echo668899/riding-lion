import { Hono } from "hono";
import { AppError } from "../lib/errors";
import { getWalletByToken } from "../lib/db";
import { nowSec, randomId, randomToken } from "../lib/ids";
import { putUpload, retentionDays } from "../lib/media";

type Bindings = { Bindings: Env };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

export const uploadRoutes = new Hono<Bindings>();

uploadRoutes.post("/uploads", async (c) => {
  const form = await c.req.parseBody({ all: true });
  const raw = form.file;
  const file = Array.isArray(raw) ? raw[0] : raw;
  if (!file || typeof file === "string") {
    throw new AppError(400, "missing_file", "Choose a JPG, PNG, or WebP photo.");
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED.has(contentType)) {
    throw new AppError(400, "invalid_type", "Only JPG, PNG, and WebP are supported.");
  }
  if (file.size > MAX_BYTES) {
    throw new AppError(400, "file_too_large", "Photo must be 15MB or smaller.");
  }

  let accessToken = typeof form.accessToken === "string" ? form.accessToken : "";
  let wallet = accessToken ? await getWalletByToken(c.env.DB, accessToken) : null;
  if (!wallet) {
    const walletId = randomId("wal");
    accessToken = randomToken();
    const created = nowSec();
    const expires = created + 30 * 86400;
    await c.env.DB.prepare(
      `INSERT INTO wallets (id, access_token, credits_balance, created_at, expires_at) VALUES (?, ?, 0, ?, ?)`,
    )
      .bind(walletId, accessToken, created, expires)
      .run();
    wallet = {
      id: walletId,
      access_token: accessToken,
      credits_balance: 0,
      created_at: created,
      expires_at: expires,
    };
  }

  const buf = await file.arrayBuffer();
  const saved = await putUpload(c.env, {
    walletId: wallet.id,
    accessToken: wallet.access_token,
    kind: "upload",
    contentType,
    body: buf,
    bytes: buf.byteLength,
    keyPrefix: `uploads/${wallet.id}`,
  });

  return c.json({
    accessToken: wallet.access_token,
    walletId: wallet.id,
    creditsBalance: wallet.credits_balance,
    assetId: saved.id,
    retainUntil: saved.retainUntil,
    retentionDays: retentionDays(c.env),
  });
});
