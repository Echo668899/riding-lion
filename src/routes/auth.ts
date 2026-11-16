import { Hono } from "hono";
import {
  getWalletByEmail,
  isValidEmail,
  mergeGuestIntoEmailWallet,
  normalizeEmail,
  requestLoginCode,
  verifyLoginCode,
} from "../lib/auth";
import { getWalletByToken, type JobRow } from "../lib/db";
import { AppError } from "../lib/errors";
import { nowSec } from "../lib/ids";
import { appBaseUrl, signedMediaUrl } from "../lib/media";

type Bindings = { Bindings: Env };

export const authRoutes = new Hono<Bindings>();

authRoutes.post("/auth/request-code", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string };
  try {
    const result = await requestLoginCode(c.env, body.email || "");
    return c.json(result);
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    throw new AppError(e.status || 400, e.code || "auth_error", e.message || "Could not send code");
  }
});

authRoutes.post("/auth/verify", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    guestAccessToken?: string;
  };
  try {
    const wallet = await verifyLoginCode(
      c.env,
      body.email || "",
      body.code || "",
      body.guestAccessToken || null,
    );
    return c.json({
      ok: true,
      accessToken: wallet.access_token,
      walletId: wallet.id,
      email: wallet.email,
      creditsBalance: wallet.credits_balance,
    });
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    throw new AppError(e.status || 400, e.code || "auth_error", e.message || "Login failed");
  }
});

/** Attach / merge current guest session into an already-logged-in email wallet. */
authRoutes.post("/auth/bind-email", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { accessToken?: string; email?: string };
  if (!body.accessToken) throw new AppError(400, "missing_token", "accessToken required");
  const email = normalizeEmail(body.email || "");
  if (!isValidEmail(email)) throw new AppError(400, "invalid_email", "Enter a valid email address.");

  const guest = await getWalletByToken(c.env.DB, body.accessToken);
  if (!guest) throw new AppError(401, "invalid_token", "Session expired. Sign in again.");

  // Prefer existing email wallet if present
  let emailWallet = await getWalletByEmail(c.env.DB, email);
  if (!emailWallet) {
    const t = nowSec();
    await c.env.DB.prepare(`UPDATE wallets SET email = ?, email_updated_at = ? WHERE id = ?`)
      .bind(email, t, guest.id)
      .run();
    return c.json({
      ok: true,
      accessToken: guest.access_token,
      email,
      creditsBalance: guest.credits_balance,
      merged: false,
    });
  }

  if (emailWallet.id === guest.id) {
    return c.json({
      ok: true,
      accessToken: guest.access_token,
      email,
      creditsBalance: guest.credits_balance,
      merged: false,
    });
  }

  const merged = await mergeGuestIntoEmailWallet(c.env, emailWallet, guest.access_token);
  return c.json({
    ok: true,
    accessToken: merged.access_token,
    email: merged.email,
    creditsBalance: merged.credits_balance,
    merged: true,
  });
});

authRoutes.get("/account", async (c) => {
  const token = c.req.query("accessToken");
  if (!token) throw new AppError(400, "missing_token", "accessToken required");
  const wallet = await getWalletByToken(c.env.DB, token);
  if (!wallet) throw new AppError(401, "invalid_token", "Sign in again.");
  if (!wallet.email) {
    throw new AppError(403, "email_required", "Sign in with email to open your account library.");
  }

  const t = nowSec();
  const jobs = await c.env.DB.prepare(
    `SELECT j.*, a.retain_until AS output_retain_until, a.deleted_at AS output_deleted_at
     FROM generation_jobs j
     LEFT JOIN assets a ON a.id = j.output_asset_id
     WHERE j.wallet_id = ?
     ORDER BY j.created_at DESC
     LIMIT 50`,
  )
    .bind(wallet.id)
    .all<
      JobRow & {
        output_retain_until?: number | null;
        output_deleted_at?: number | null;
      }
    >();

  const base = appBaseUrl(c.req.raw, c.env);
  const retentionDays = Number(c.env.ASSET_RETENTION_DAYS || "7");

  const clips = [];
  for (const job of jobs.results || []) {
    const retainUntil = job.output_retain_until ?? null;
    const expired = retainUntil != null ? retainUntil <= t : false;
    const deleted = Boolean(job.output_deleted_at);
    const available =
      job.status === "succeeded" && Boolean(job.output_r2_key) && !deleted && !expired;

    let playUrl: string | null = null;
    let downloadUrl: string | null = null;
    if (available && job.output_r2_key) {
      playUrl = await signedMediaUrl(c.env, base, job.output_r2_key, "inline");
      downloadUrl = await signedMediaUrl(c.env, base, job.output_r2_key, "attachment");
    }

    clips.push({
      jobId: job.id,
      status: job.status,
      createdAt: job.created_at,
      creditsCharged: job.credits_charged,
      retainUntil,
      retentionDays,
      daysLeft:
        retainUntil != null ? Math.max(0, Math.ceil((retainUntil - t) / 86400)) : null,
      available,
      expired,
      deleted,
      errorMessage: job.error_message,
      playUrl,
      downloadUrl,
      resultPath: `/r/${wallet.access_token}?job=${job.id}`,
    });
  }

  return c.json({
    email: wallet.email,
    accessToken: wallet.access_token,
    creditsBalance: wallet.credits_balance,
    retentionDays,
    clips,
  });
});
