import { createMediaTicket, verifyMediaTicket } from "./crypto";
import { nowSec, randomId } from "./ids";

export function retentionDays(env: Env): number {
  return Number(env.ASSET_RETENTION_DAYS || "7");
}

export function signedTtl(env: Env): number {
  return Number(env.SIGNED_URL_TTL_SECONDS || "7200");
}

export function requireSigningSecret(env: Env): string {
  if (!env.MEDIA_SIGNING_SECRET) {
    throw new Error("MEDIA_SIGNING_SECRET is required");
  }
  return env.MEDIA_SIGNING_SECRET;
}

export function appBaseUrl(request: Request, env: Env): string {
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function signedMediaUrl(
  env: Env,
  baseUrl: string,
  key: string,
  disposition: "inline" | "attachment" = "inline",
  ttlSeconds?: number,
): Promise<string> {
  const exp = nowSec() + (ttlSeconds ?? signedTtl(env));
  const token = await createMediaTicket(requireSigningSecret(env), { key, exp, disposition });
  return `${baseUrl}/api/media/${encodeURIComponent(token)}`;
}

export async function putUpload(
  env: Env,
  opts: {
    walletId: string | null;
    accessToken: string | null;
    kind: string;
    contentType: string;
    body: ArrayBuffer | ReadableStream | Uint8Array;
    bytes?: number;
    keyPrefix: string;
  },
): Promise<{ id: string; key: string; retainUntil: number }> {
  const id = randomId("asset");
  const ext = extFromContentType(opts.contentType);
  const key = `${opts.keyPrefix}/${id}${ext}`;
  const retainUntil = nowSec() + retentionDays(env) * 86400;
  await env.BUCKET.put(key, opts.body, {
    httpMetadata: { contentType: opts.contentType },
    customMetadata: { assetId: id, kind: opts.kind },
  });
  await env.DB.prepare(
    `INSERT INTO assets (id, wallet_id, access_token, kind, r2_key, content_type, bytes, retain_until, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      opts.walletId,
      opts.accessToken,
      opts.kind,
      key,
      opts.contentType,
      opts.bytes ?? null,
      retainUntil,
      nowSec(),
    )
    .run();
  return { id, key, retainUntil };
}

export async function streamObjectResponse(
  env: Env,
  token: string,
): Promise<Response> {
  const ticket = await verifyMediaTicket(requireSigningSecret(env), token);
  if (!ticket) {
    return Response.json({ error: { code: "invalid_media_token", message: "Media link expired or invalid." } }, { status: 403 });
  }
  const obj = await env.BUCKET.get(ticket.key);
  if (!obj) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=60");
  const filename = ticket.key.split("/").pop() || "file";
  if (ticket.disposition === "attachment") {
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  } else {
    headers.set("content-disposition", `inline; filename="${filename}"`);
  }
  return new Response(obj.body, { headers });
}

function extFromContentType(ct: string): string {
  if (ct.includes("jpeg")) return ".jpg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("mp4")) return ".mp4";
  return "";
}
