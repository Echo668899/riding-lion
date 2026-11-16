import { getJob, getWallet } from "./db";
import { appBaseUrl } from "./media";
import { nowSec } from "./ids";

export const SUPPORT_EMAIL = "support@ridinglion.com";
export const SUPPORT_FROM = `Riding Lion <${SUPPORT_EMAIL}>`;

function resendKey(env: Env): string | null {
  return env.RESEND_API_KEY || null;
}

export function mailFrom(env: Env): string {
  return env.EMAIL_FROM || SUPPORT_FROM;
}

export async function sendResendEmail(
  env: Env,
  input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
  },
): Promise<{ id: string } | { error: string; skipped?: boolean }> {
  const key = resendKey(env);
  if (!key) {
    console.warn("RESEND_API_KEY missing — email skipped:", input.subject, input.to);
    return { error: "RESEND_API_KEY not configured", skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(env),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || SUPPORT_EMAIL,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok || !body.id) {
    const msg = body.message || body.name || `Resend HTTP ${res.status}`;
    console.error("Resend send failed", msg);
    return { error: msg };
  }
  return { id: body.id };
}

export async function notifyJobReady(env: Env, jobId: string, requestUrlForBase?: string): Promise<void> {
  const job = await getJob(env.DB, jobId);
  if (!job) return;
  if (job.status !== "succeeded") return;
  if (job.notify_email_sent_at) return;

  const wallet = await getWallet(env.DB, job.wallet_id);
  const to = (job.notify_email || wallet?.email || "").trim().toLowerCase();
  if (!to || !to.includes("@")) {
    console.warn("No notify email for job", jobId);
    return;
  }

  const origin = (env.APP_BASE_URL || "").replace(/\/$/, "") || "https://ridinglion.com";
  const resultUrl = `${origin}/r/${job.access_token}?job=${job.id}`;

  const html = `
    <div style="font-family:Manrope,Helvetica,Arial,sans-serif;line-height:1.5;color:#12201b">
      <h1 style="font-size:22px;margin:0 0 12px">Your Riding Lion short is ready</h1>
      <p style="margin:0 0 12px">Generation finished successfully. Open your private result link to play or download the clip.</p>
      <p style="margin:0 0 18px">
        <a href="${resultUrl}" style="display:inline-block;background:#e3a428;color:#1a1406;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">
          View my clip
        </a>
      </p>
      <p style="margin:0;color:#5a6b63;font-size:13px">Or copy this link:<br/>${resultUrl}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <p style="margin:0;color:#5a6b63;font-size:12px">
        Riding Lion · Questions? Reply to this email or write ${SUPPORT_EMAIL}
      </p>
    </div>
  `;

  const sent = await sendResendEmail(env, {
    to,
    subject: "Your Riding Lion short is ready",
    html,
    text: `Your Riding Lion short is ready.\n\nView / download: ${resultUrl}\n\nSupport: ${SUPPORT_EMAIL}`,
  });

  if ("id" in sent) {
    await env.DB.prepare(
      `UPDATE generation_jobs SET notify_email_sent_at = ?, notify_email_id = ?, notify_email = ? WHERE id = ? AND notify_email_sent_at IS NULL`,
    )
      .bind(nowSec(), sent.id, to, jobId)
      .run();
  }
  // skipped / failed: leave notify_email_sent_at null so a later retry can send

  void requestUrlForBase;
  void appBaseUrl;
}

export async function fetchReceivedEmail(env: Env, emailId: string): Promise<unknown | null> {
  const key = resendKey(env);
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  return res.json();
}
