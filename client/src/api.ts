export type CreditPack = {
  id: string;
  credits: number;
  priceCents: number;
  label: string;
  recommended: boolean;
};

export type Catalog = {
  appName: string;
  retentionDays: number;
  mockGeneration: boolean;
  template: {
    id: string;
    slug: string;
    version: number;
    title: string;
    durationSec: number;
    aspectRatio: string;
    resolution: string;
    priceCredits: number;
    media: {
      sourceVideoUrl: string | null;
      coverUrl: string | null;
      samplePhotoUrl: string | null;
      sampleOutputUrl: string | null;
      sampleKind: "sample_output" | "template_preview";
    } | null;
  } | null;
  creditPacks: CreditPack[];
};

export type Job = {
  jobId: string;
  accessToken: string;
  status: string;
  creditsCharged: number;
  uploadAssetId: string | null;
  outputAssetId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  refundStatus: string;
  outputPlayUrl: string | null;
  outputDownloadUrl: string | null;
  uploadImageUrl?: string | null;
  templateVideoUrl?: string | null;
  resultPath: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message) as Error & { code?: string; status?: number };
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  catalog: () => request<Catalog>("/api/catalog"),
  upload: async (file: File, accessToken?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (accessToken) form.append("accessToken", accessToken);
    return request<{
      accessToken: string;
      walletId: string;
      creditsBalance: number;
      assetId: string;
      retainUntil: number;
      retentionDays: number;
    }>("/api/uploads", { method: "POST", body: form });
  },
  checkout: (packId: string, accessToken?: string, idempotencyKey?: string) =>
    request<{
      paymentId: string;
      accessToken: string;
      status: string;
      checkoutUrl: string;
      notice: string;
      pack: { id: string; credits: number; priceCents: number; label: string };
    }>("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, accessToken, idempotencyKey }),
    }),
  getPayment: (id: string) =>
    request<{
      paymentId: string;
      status: string;
      amountCents: number;
      creditsGranted: number;
      accessToken?: string;
      creditsBalance: number;
      notice?: string;
      pack: { id: string; credits: number; priceCents: number; label: string } | null;
    }>(`/api/payments/${id}`),
  confirmMock: (paymentId: string) =>
    request<{
      paymentId: string;
      status: string;
      accessToken?: string;
      creditsBalance: number;
      duplicate?: boolean;
    }>("/api/payments/mock/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    }),
  cancelMock: (paymentId: string) =>
    request<{ paymentId: string; status: string }>("/api/payments/mock/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    }),
  createGeneration: (accessToken: string, assetId: string, email: string, idempotencyKey?: string) =>
    request<Job>("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, assetId, email, idempotencyKey }),
    }),
  saveEmail: (accessToken: string, email: string) =>
    request<{ ok: boolean; email: string; supportEmail: string }>("/api/wallet/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, email }),
    }),
  getEmail: (accessToken: string) =>
    request<{ email: string | null; supportEmail: string }>(
      `/api/wallet/email?accessToken=${encodeURIComponent(accessToken)}`,
    ),
  getGeneration: (jobId: string, accessToken: string) =>
    request<Job>(`/api/generations/${jobId}?accessToken=${encodeURIComponent(accessToken)}`),
  session: (accessToken: string) =>
    request<{ accessToken: string; creditsBalance: number; jobs: Job[] }>(
      `/api/session/${encodeURIComponent(accessToken)}`,
    ),
  refund: (jobId: string, accessToken: string, reason?: string) =>
    request<{ jobId: string; refundStatus: string; creditsBalance: number; notice?: string }>(
      `/api/generations/${jobId}/refund`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, reason }),
      },
    ),
  deleteAsset: (assetId: string, accessToken: string) =>
    request<{ ok: boolean }>(`/api/assets/${assetId}?accessToken=${encodeURIComponent(accessToken)}`, {
      method: "DELETE",
    }),
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const TOKEN_KEY = "rl_access_token";
export const ASSET_KEY = "rl_asset_id";
export const PACK_KEY = "rl_pack_id";
export const EMAIL_KEY = "rl_notify_email";
export const SUPPORT_EMAIL = "support@ridinglion.com";
