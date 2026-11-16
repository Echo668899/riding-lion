import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookResult } from "./types";

/**
 * Local simulated checkout. Creem (and similar) forbid real-person replacement
 * products in production — keep this adapter and swap providers later.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const url = new URL(input.successUrl);
    // Checkout page itself collects confirm; still return a dedicated mock URL shape.
    url.searchParams.set("paymentId", input.paymentId);
    url.searchParams.set("provider", "mock");
    return {
      provider: this.name,
      checkoutUrl: url.toString(),
    };
  }

  async parseWebhook(request: Request): Promise<WebhookResult> {
    const body = (await request.json()) as {
      event?: string;
      paymentId?: string;
      providerEventId?: string;
      amountCents?: number;
      credits?: number;
    };
    if (!body.paymentId || !body.providerEventId) {
      return { kind: "ignored" };
    }
    if (body.event === "payment.canceled") {
      return {
        kind: "canceled",
        paymentId: body.paymentId,
        providerEventId: body.providerEventId,
      };
    }
    if (body.event === "payment.paid") {
      return {
        kind: "paid",
        paymentId: body.paymentId,
        providerEventId: body.providerEventId,
        amountCents: body.amountCents ?? 0,
        credits: body.credits ?? 0,
      };
    }
    return { kind: "ignored" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}
