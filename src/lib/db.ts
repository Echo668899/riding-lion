export type TemplateRow = {
  id: string;
  slug: string;
  active: number;
  version: number;
  title: string;
  target_description: string;
  prompt_template: string;
  source_video_key: string;
  cover_key: string | null;
  sample_photo_key: string | null;
  sample_output_key: string | null;
  duration_sec: number;
  aspect_ratio: string;
  resolution: string;
  codec: string;
  generate_audio: number;
  price_credits: number;
};

export type TemplateVersionRow = TemplateRow & {
  template_id: string;
};

export type CreditPackRow = {
  id: string;
  credits: number;
  price_cents: number;
  label: string;
  recommended: number;
  active: number;
  sort_order: number;
};

export type WalletRow = {
  id: string;
  access_token: string;
  credits_balance: number;
  created_at: number;
  expires_at: number;
  email?: string | null;
  email_updated_at?: number | null;
};

export type PaymentRow = {
  id: string;
  wallet_id: string;
  pack_id: string;
  provider: string;
  status: string;
  amount_cents: number;
  credits_granted: number;
  idempotency_key: string;
  provider_event_id: string | null;
  created_at: number;
  updated_at: number;
};

export type JobRow = {
  id: string;
  wallet_id: string;
  access_token: string;
  template_id: string;
  template_version_id: string;
  status: string;
  credits_charged: number;
  upload_asset_id: string | null;
  upload_r2_key: string | null;
  output_asset_id: string | null;
  output_r2_key: string | null;
  fal_request_id: string | null;
  fal_status_url: string | null;
  fal_response_url: string | null;
  workflow_instance_id: string | null;
  error_code: string | null;
  error_message: string | null;
  refund_status: string;
  notify_email?: string | null;
  notify_email_sent_at?: number | null;
  notify_email_id?: string | null;
  created_at: number;
  updated_at: number;
};

export async function getActiveTemplate(db: D1Database): Promise<TemplateRow | null> {
  return db
    .prepare(`SELECT * FROM templates WHERE active = 1 ORDER BY updated_at DESC LIMIT 1`)
    .first<TemplateRow>();
}

export async function getTemplateVersion(
  db: D1Database,
  id: string,
): Promise<(TemplateVersionRow & { id: string }) | null> {
  return db.prepare(`SELECT * FROM template_versions WHERE id = ?`).bind(id).first();
}

export async function getLatestTemplateVersion(
  db: D1Database,
  templateId: string,
): Promise<{ id: string } & TemplateVersionRow | null> {
  return db
    .prepare(
      `SELECT * FROM template_versions WHERE template_id = ? ORDER BY version DESC LIMIT 1`,
    )
    .bind(templateId)
    .first();
}

export async function listCreditPacks(db: D1Database): Promise<CreditPackRow[]> {
  const res = await db
    .prepare(`SELECT * FROM credit_packs WHERE active = 1 ORDER BY sort_order ASC`)
    .all<CreditPackRow>();
  return res.results ?? [];
}

export async function getCreditPack(db: D1Database, id: string): Promise<CreditPackRow | null> {
  return db.prepare(`SELECT * FROM credit_packs WHERE id = ? AND active = 1`).bind(id).first();
}

export async function getWalletByToken(db: D1Database, token: string): Promise<WalletRow | null> {
  return db.prepare(`SELECT * FROM wallets WHERE access_token = ?`).bind(token).first();
}

export async function getWallet(db: D1Database, id: string): Promise<WalletRow | null> {
  return db.prepare(`SELECT * FROM wallets WHERE id = ?`).bind(id).first();
}

export async function getJob(db: D1Database, id: string): Promise<JobRow | null> {
  return db.prepare(`SELECT * FROM generation_jobs WHERE id = ?`).bind(id).first();
}

export async function getJobByFalRequestId(
  db: D1Database,
  falRequestId: string,
): Promise<JobRow | null> {
  return db
    .prepare(`SELECT * FROM generation_jobs WHERE fal_request_id = ?`)
    .bind(falRequestId)
    .first();
}

export async function getLatestJobForToken(
  db: D1Database,
  token: string,
): Promise<JobRow | null> {
  return db
    .prepare(`SELECT * FROM generation_jobs WHERE access_token = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(token)
    .first();
}
