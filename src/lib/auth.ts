import { getWallet, getWalletByToken, type WalletRow } from "./db";
import { sendResendEmail, SUPPORT_EMAIL } from "./email";
import { nowSec, randomId, randomToken } from "./ids";

const CODE_TTL_SEC = 10 * 60;
const CODE_COOLDOWN_SEC = 45;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function codePepper(env: Env): string {
  return env.MEDIA_SIGNING_SECRET || "riding-lion-dev-pepper";
}

export async function hashLoginCode(env: Env, email: string, code: string): Promise<string> {
  return sha256Hex(`${codePepper(env)}:${normalizeEmail(email)}:${code}`);
}

export async function getWalletByEmail(db: D1Database, email: string): Promise<WalletRow | null> {
  return db
    .prepare(`SELECT * FROM wallets WHERE email = ? ORDER BY created_at ASC LIMIT 1`)
    .bind(normalizeEmail(email))
    .first<WalletRow>();
}

export async function ensureEmailWallet(env: Env, email: string): Promise<WalletRow> {
  const normalized = normalizeEmail(email);
  const matches = await env.DB.prepare(
    `SELECT * FROM wallets WHERE email = ? ORDER BY created_at ASC`,
  )
    .bind(normalized)
    .all<WalletRow>();
  const rows = matches.results || [];
  if (rows.length) {
    let primary = rows[0]!;
    for (const extra of rows.slice(1)) {
      primary = await mergeGuestIntoEmailWallet(env, primary, extra.access_token);
    }
    return (await getWallet(env.DB, primary.id))!;
  }

  const id = randomId("wal");
  const accessToken = randomToken();
  const t = nowSec();
  const expires = t + 365 * 86400;
  await env.DB.prepare(
    `INSERT INTO wallets (id, access_token, credits_balance, created_at, expires_at, email, email_updated_at)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
  )
    .bind(id, accessToken, t, expires, normalized, t)
    .run();
  return (await getWallet(env.DB, id))!;
}

/**
 * Move guest credits + jobs + assets onto the email wallet, then retire the guest token.
 */
export async function mergeGuestIntoEmailWallet(
  env: Env,
  emailWallet: WalletRow,
  guestAccessToken?: string | null,
): Promise<WalletRow> {
  if (!guestAccessToken) return (await getWallet(env.DB, emailWallet.id))!;
  const guest = await getWalletByToken(env.DB, guestAccessToken);
  if (!guest || guest.id === emailWallet.id) {
    return (await getWallet(env.DB, emailWallet.id))!;
  }
  // Do not merge another email-bound account into this one
  if (guest.email && guest.email !== emailWallet.email) {
    return (await getWallet(env.DB, emailWallet.id))!;
  }

  const t = nowSec();
  const credits = Math.max(0, guest.credits_balance || 0);

  const stmts = [
    env.DB.prepare(
      `UPDATE wallets SET credits_balance = credits_balance + ?, email = COALESCE(email, ?), email_updated_at = ? WHERE id = ?`,
    ).bind(credits, emailWallet.email, t, emailWallet.id),
    env.DB.prepare(
      `UPDATE generation_jobs SET wallet_id = ?, access_token = ? WHERE wallet_id = ?`,
    ).bind(emailWallet.id, emailWallet.access_token, guest.id),
    env.DB.prepare(
      `UPDATE assets SET wallet_id = ?, access_token = ? WHERE wallet_id = ?`,
    ).bind(emailWallet.id, emailWallet.access_token, guest.id),
    env.DB.prepare(
      `UPDATE payments SET wallet_id = ? WHERE wallet_id = ?`,
    ).bind(emailWallet.id, guest.id),
    env.DB.prepare(
      `UPDATE wallets SET credits_balance = 0, access_token = ?, email = NULL, email_updated_at = NULL WHERE id = ?`,
    ).bind(`merged_${guest.access_token.slice(0, 24)}_${t}`, guest.id),
  ];
  await env.DB.batch(stmts);
  return (await getWallet(env.DB, emailWallet.id))!;
}

export async function requestLoginCode(
  env: Env,
  emailRaw: string,
): Promise<{ ok: true; expiresInSec: number; devCode?: string }> {
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    throw Object.assign(new Error("Enter a valid email address."), { code: "invalid_email", status: 400 });
  }

  const recent = await env.DB.prepare(
    `SELECT created_at FROM login_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(email)
    .first<{ created_at: number }>();
  if (recent && nowSec() - recent.created_at < CODE_COOLDOWN_SEC) {
    throw Object.assign(new Error("Please wait a moment before requesting another code."), {
      code: "rate_limited",
      status: 429,
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = randomId("otp");
  const t = nowSec();
  await env.DB.prepare(
    `INSERT INTO login_codes (id, email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, email, await hashLoginCode(env, email, code), t + CODE_TTL_SEC, t)
    .run();

  const sent = await sendResendEmail(env, {
    to: email,
    subject: "Your Riding Lion login code",
    html: `<div style="font-family:Manrope,Helvetica,Arial,sans-serif;line-height:1.5;color:#12201b">
      <h1 style="font-size:22px;margin:0 0 12px">Riding Lion login</h1>
      <p style="margin:0 0 12px">Your one-time code is:</p>
      <p style="font-size:28px;letter-spacing:0.2em;font-weight:700;margin:0 0 16px">${code}</p>
      <p style="margin:0;color:#5a6b63;font-size:13px">Expires in ${Math.floor(CODE_TTL_SEC / 60)} minutes. If you did not request this, ignore this email.</p>
      <p style="margin:16px 0 0;color:#5a6b63;font-size:12px">Support: ${SUPPORT_EMAIL}</p>
    </div>`,
    text: `Your Riding Lion login code is ${code}. It expires in ${Math.floor(CODE_TTL_SEC / 60)} minutes.`,
  });

  const result: { ok: true; expiresInSec: number; devCode?: string } = {
    ok: true,
    expiresInSec: CODE_TTL_SEC,
  };
  if ("skipped" in sent && sent.skipped) {
    // Local / missing RESEND_API_KEY — log for operators; never expose on public hosts
    console.warn("Login code (Resend skipped):", email, code);
    const base = (env.APP_BASE_URL || "").toLowerCase();
    const local =
      !base ||
      base.includes("localhost") ||
      base.includes("127.0.0.1") ||
      base.includes("workers.dev");
    if (local) result.devCode = code;
  }
  return result;
}

export async function verifyLoginCode(
  env: Env,
  emailRaw: string,
  codeRaw: string,
  guestAccessToken?: string | null,
): Promise<WalletRow> {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.trim().replace(/\s+/g, "");
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    throw Object.assign(new Error("Enter the 6-digit code from your email."), {
      code: "invalid_code",
      status: 400,
    });
  }

  const row = await env.DB.prepare(
    `SELECT * FROM login_codes
     WHERE email = ? AND consumed_at IS NULL AND expires_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(email, nowSec())
    .first<{ id: string; code_hash: string }>();

  if (!row) {
    throw Object.assign(new Error("Code expired or not found. Request a new one."), {
      code: "code_expired",
      status: 401,
    });
  }

  const expected = await hashLoginCode(env, email, code);
  if (expected !== row.code_hash) {
    throw Object.assign(new Error("That code is incorrect."), { code: "invalid_code", status: 401 });
  }

  await env.DB.prepare(`UPDATE login_codes SET consumed_at = ? WHERE id = ?`).bind(nowSec(), row.id).run();

  let wallet = await ensureEmailWallet(env, email);
  wallet = await mergeGuestIntoEmailWallet(env, wallet, guestAccessToken);

  // Extend session lifetime on login
  const t = nowSec();
  await env.DB.prepare(`UPDATE wallets SET expires_at = ?, email_updated_at = ? WHERE id = ?`)
    .bind(t + 365 * 86400, t, wallet.id)
    .run();

  return (await getWallet(env.DB, wallet.id))!;
}
