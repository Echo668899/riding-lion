export type CheckoutInput = {
  packId: string;
  walletId: string;
  paymentId: string;
  amountCents: number;
  credits: number;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  checkoutUrl: string;
  provider: string;
};

export type WebhookResult =
  | { kind: "ignored" }
  | {
      kind: "paid";
      paymentId: string;
      providerEventId: string;
      amountCents: number;
      credits: number;
    }
  | {
      kind: "canceled";
      paymentId: string;
      providerEventId: string;
    };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Reserved for future real providers that verify signatures server-side. */
  parseWebhook?(request: Request): Promise<WebhookResult>;
}
