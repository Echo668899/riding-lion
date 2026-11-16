import { Hono } from "hono";
import { getWalletByToken } from "../lib/db";
import { AppError } from "../lib/errors";
import { fetchReceivedEmail, sendResendEmail, SUPPORT_EMAIL } from "../lib/email";
import { nowSec, randomId } from "../lib/ids";

type Bindings = { Bindings: Env };

export const emailRoutes = new Hono<Bindings>();

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

emailRoutes.post("/wallet/email", async (c) => {
  const body = await c.req.json<{ accessToken?: string; email?: string }>();
  if (!body.accessToken) throw new AppError(400, "missing_token", "accessToken required");
  const email = (body.email || "").trim().toLowerCase();
  if (!validEmail(email)) throw new AppError(400, "invalid_email", "Enter a valid email address.");

  const wallet = await getWalletByToken(c.env.DB, body.accessToken);
  if (!wallet) throw new AppError(401, "invalid_token", "Session expired. Upload again.");

  const t = nowSec();
  await c.env.DB.prepare(`UPDATE wallets SET email = ?, email_updated_at = ? WHERE id = ?`)
    .bind(email, t, wallet.id)
    .run();

  return c.json({ ok: true, email, supportEmail: SUPPORT_EMAIL });
});

emailRoutes.get("/wallet/email", async (c) => {
  const token = c.req.query("accessToken");
  if (!token) throw new AppError(400, "missing_token", "accessToken required");
  const wallet = await getWalletByToken(c.env.DB, token);
  if (!wallet) throw new AppError(404, "not_found", "Session not found");
  return c.json({ email: wallet.email || null, supportEmail: SUPPORT_EMAIL });
});

/**
 * Resend inbound + delivery events.
 * Configure webhook URL: https://your-domain/api/webhooks/resend
 * Subscribe at least to email.received (and optionally email.delivered / email.bounced).
 */
emailRoutes.post("/webhooks/resend", async (c) => {
  const raw = await c.req.text();
  if (c.env.RESEND_WEBHOOK_SECRET) {
    const q = new URL(c.req.url).searchParams.get("secret") || "";
    const hdr = c.req.header("x-resend-secret") || "";
    if (q !== c.env.RESEND_WEBHOOK_SECRET && hdr !== c.env.RESEND_WEBHOOK_SECRET) {
      return c.json({ error: "unauthorized" }, 401);
    }
  }

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[];
      subject?: string;
      message_id?: string;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (event.type === "email.received" && event.data?.email_id) {
    const detail = await fetchReceivedEmail(c.env, event.data.email_id);
    const id = randomId("inb");
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO inbound_emails
       (id, resend_email_id, from_addr, to_addrs, subject, message_id, received_at, raw_json, processed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
      .bind(
        id,
        event.data.email_id,
        event.data.from || null,
        JSON.stringify(event.data.to || []),
        event.data.subject || null,
        event.data.message_id || null,
        nowSec(),
        JSON.stringify({ event, detail }),
        nowSec(),
      )
      .run();

    // Auto-ack from support@ so replies are not a black hole
    if (event.data.from && validEmail(event.data.from)) {
      await sendResendEmail(c.env, {
        to: event.data.from,
        subject: `Re: ${event.data.subject || "Your message to Riding Lion"}`,
        html: `<p>Thanks for contacting Riding Lion Support.</p>
          <p>We received your email at <strong>${SUPPORT_EMAIL}</strong> and will follow up shortly.</p>
          <p style="color:#666;font-size:12px">This is an automated acknowledgement.</p>`,
        text: `Thanks for contacting Riding Lion Support. We received your email at ${SUPPORT_EMAIL} and will follow up shortly.`,
      });
      await c.env.DB.prepare(`UPDATE inbound_emails SET processed = 1 WHERE id = ?`).bind(id).run();
    }

    return c.json({ ok: true, stored: true });
  }

  return c.json({ ok: true, ignored: true });
});
