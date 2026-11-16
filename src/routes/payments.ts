import { Hono } from "hono";
import { getCreditPack, getWallet, getWalletByToken, type PaymentRow } from "../lib/db";
import { AppError } from "../lib/errors";
import { nowSec, randomId, randomToken } from "../lib/ids";
import { getPaymentProvider } from "../payments/mock";

type Bindings = { Bindings: Env };

export const paymentRoutes = new Hono<Bindings>();

async function ensureWallet(env: Env, accessToken?: string | null) {
  if (accessToken) {
    const existing = await getWalletByToken(env.DB, accessToken);
    if (existing) return existing;
  }
  const walletId = randomId("wal");
  const token = randomToken();
  const created = nowSec();
  await env.DB.prepare(
    `INSERT INTO wallets (id, access_token, credits_balance, created_at, expires_at) VALUES (?, ?, 0, ?, ?)`,
  )
    .bind(walletId, token, created, created + 30 * 86400)
    .run();
  return (await getWallet(env.DB, walletId))!;
}

paymentRoutes.post("/payments/checkout", async (c) => {
  const body = await c.req.json<{ packId?: string; accessToken?: string; idempotencyKey?: string }>();
  if (!body.packId) throw new AppError(400, "missing_pack", "Select a credit pack.");
  const pack = await getCreditPack(c.env.DB, body.packId);
  if (!pack) throw new AppError(404, "pack_not_found", "Credit pack not found.");

  const wallet = await ensureWallet(c.env, body.accessToken);
  const idempotencyKey = body.idempotencyKey || randomId("idem");

  const existing = await c.env.DB.prepare(
    `SELECT * FROM payments WHERE idempotency_key = ?`,
  )
    .bind(idempotencyKey)
    .first<PaymentRow>();

  if (existing) {
    const provider = getPaymentProvider();
    const origin = new URL(c.req.url).origin;
    const checkout = await provider.createCheckout({
      packId: pack.id,
      walletId: wallet.id,
      paymentId: existing.id,
      amountCents: existing.amount_cents,
      credits: existing.credits_granted,
      idempotencyKey,
      successUrl: `${origin}/checkout?paymentId=${existing.id}`,
      cancelUrl: `${origin}/checkout?canceled=1&paymentId=${existing.id}`,
    });
    return c.json({
      paymentId: existing.id,
      accessToken: wallet.access_token,
      status: existing.status,
      checkoutUrl: checkout.checkoutUrl,
      provider: provider.name,
      simulated: true,
      notice: "Simulated payment — you will not be charged.",
      pack: {
        id: pack.id,
        credits: pack.credits,
        priceCents: pack.price_cents,
        label: pack.label,
      },
    });
  }

  const paymentId = randomId("pay");
  const t = nowSec();
  await c.env.DB.prepare(
    `INSERT INTO payments (id, wallet_id, pack_id, provider, status, amount_cents, credits_granted, idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, 'mock', 'pending', ?, ?, ?, ?, ?)`,
  )
    .bind(paymentId, wallet.id, pack.id, pack.price_cents, pack.credits, idempotencyKey, t, t)
    .run();

  const provider = getPaymentProvider();
  const origin = new URL(c.req.url).origin;
  const checkout = await provider.createCheckout({
    packId: pack.id,
    walletId: wallet.id,
    paymentId,
    amountCents: pack.price_cents,
    credits: pack.credits,
    idempotencyKey,
    successUrl: `${origin}/checkout?paymentId=${paymentId}`,
    cancelUrl: `${origin}/checkout?canceled=1&paymentId=${paymentId}`,
  });

  return c.json({
    paymentId,
    accessToken: wallet.access_token,
    status: "pending",
    checkoutUrl: checkout.checkoutUrl,
    provider: provider.name,
    simulated: true,
    notice: "Simulated payment — you will not be charged.",
    pack: {
      id: pack.id,
      credits: pack.credits,
      priceCents: pack.price_cents,
      label: pack.label,
    },
  });
});

paymentRoutes.post("/payments/mock/confirm", async (c) => {
  const body = await c.req.json<{ paymentId?: string; providerEventId?: string }>();
  if (!body.paymentId) throw new AppError(400, "missing_payment", "paymentId required");
  const eventId = body.providerEventId || `mock_evt_${body.paymentId}`;
  const result = await applyPaidEvent(c.env, body.paymentId, eventId);
  return c.json(result);
});

paymentRoutes.post("/payments/mock/cancel", async (c) => {
  const body = await c.req.json<{ paymentId?: string }>();
  if (!body.paymentId) throw new AppError(400, "missing_payment", "paymentId required");
  const payment = await c.env.DB.prepare(`SELECT * FROM payments WHERE id = ?`)
    .bind(body.paymentId)
    .first<PaymentRow>();
  if (!payment) throw new AppError(404, "not_found", "Payment not found");
  if (payment.status === "paid") {
    return c.json({ paymentId: payment.id, status: "paid", message: "Already paid." });
  }
  await c.env.DB.prepare(`UPDATE payments SET status = 'canceled', updated_at = ? WHERE id = ? AND status = 'pending'`)
    .bind(nowSec(), payment.id)
    .run();
  return c.json({ paymentId: payment.id, status: "canceled" });
});

/** Idempotent paid notification — same shape a real provider webhook would call after signature verify. */
paymentRoutes.post("/webhooks/payment", async (c) => {
  const provider = getPaymentProvider();
  if (!provider.parseWebhook) throw new AppError(501, "unsupported", "Provider webhook not configured");
  const parsed = await provider.parseWebhook(c.req.raw);
  if (parsed.kind === "ignored") return c.json({ ok: true, ignored: true });
  if (parsed.kind === "canceled") {
    await c.env.DB.prepare(
      `UPDATE payments SET status = 'canceled', provider_event_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
    )
      .bind(parsed.providerEventId, nowSec(), parsed.paymentId)
      .run();
    return c.json({ ok: true, status: "canceled" });
  }
  const result = await applyPaidEvent(c.env, parsed.paymentId, parsed.providerEventId);
  return c.json({ ok: true, ...result });
});

paymentRoutes.get("/payments/:id", async (c) => {
  const payment = await c.env.DB.prepare(`SELECT * FROM payments WHERE id = ?`)
    .bind(c.req.param("id"))
    .first<PaymentRow>();
  if (!payment) throw new AppError(404, "not_found", "Payment not found");
  const wallet = await getWallet(c.env.DB, payment.wallet_id);
  const pack = await getCreditPack(c.env.DB, payment.pack_id);
  return c.json({
    paymentId: payment.id,
    status: payment.status,
    amountCents: payment.amount_cents,
    creditsGranted: payment.credits_granted,
    accessToken: wallet?.access_token,
    creditsBalance: wallet?.credits_balance ?? 0,
    simulated: payment.provider === "mock",
    notice: payment.provider === "mock" ? "Simulated payment — you will not be charged." : undefined,
    pack: pack
      ? { id: pack.id, credits: pack.credits, priceCents: pack.price_cents, label: pack.label }
      : null,
  });
});

export async function applyPaidEvent(env: Env, paymentId: string, providerEventId: string) {
  const payment = await env.DB.prepare(`SELECT * FROM payments WHERE id = ?`)
    .bind(paymentId)
    .first<PaymentRow>();
  if (!payment) throw new AppError(404, "not_found", "Payment not found");

  if (payment.status === "paid") {
    const wallet = await getWallet(env.DB, payment.wallet_id);
    return {
      paymentId: payment.id,
      status: "paid",
      accessToken: wallet?.access_token,
      creditsBalance: wallet?.credits_balance ?? 0,
      duplicate: true,
    };
  }

  const t = nowSec();
  // Conditional update prevents double credit grants
  const updated = await env.DB.prepare(
    `UPDATE payments SET status = 'paid', provider_event_id = ?, updated_at = ?
     WHERE id = ? AND status = 'pending'`,
  )
    .bind(providerEventId, t, paymentId)
    .run();

  if (!updated.meta.changes) {
    const wallet = await getWallet(env.DB, payment.wallet_id);
    return {
      paymentId: payment.id,
      status: "paid",
      accessToken: wallet?.access_token,
      creditsBalance: wallet?.credits_balance ?? 0,
      duplicate: true,
    };
  }

  await env.DB.prepare(
    `UPDATE wallets SET credits_balance = credits_balance + ? WHERE id = ?`,
  )
    .bind(payment.credits_granted, payment.wallet_id)
    .run();

  const wallet = await getWallet(env.DB, payment.wallet_id);
  return {
    paymentId: payment.id,
    status: "paid",
    accessToken: wallet?.access_token,
    creditsBalance: wallet?.credits_balance ?? 0,
    duplicate: false,
  };
}
