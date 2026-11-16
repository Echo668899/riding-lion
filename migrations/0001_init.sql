-- Templates (mutable current pointer)
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  target_description TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  source_video_key TEXT NOT NULL,
  cover_key TEXT,
  sample_photo_key TEXT,
  sample_output_key TEXT,
  duration_sec REAL NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  resolution TEXT NOT NULL DEFAULT '720p',
  codec TEXT NOT NULL DEFAULT 'H264',
  generate_audio INTEGER NOT NULL DEFAULT 0,
  price_credits INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Immutable snapshots used by orders
CREATE TABLE template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  target_description TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  source_video_key TEXT NOT NULL,
  cover_key TEXT,
  sample_photo_key TEXT,
  sample_output_key TEXT,
  duration_sec REAL NOT NULL,
  aspect_ratio TEXT NOT NULL,
  resolution TEXT NOT NULL,
  codec TEXT NOT NULL,
  generate_audio INTEGER NOT NULL DEFAULT 0,
  price_credits INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(template_id, version)
);

CREATE TABLE credit_packs (
  id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  label TEXT NOT NULL,
  recommended INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL UNIQUE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  pack_id TEXT NOT NULL REFERENCES credit_packs(id),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits_granted INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_event_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_payments_wallet ON payments(wallet_id, created_at DESC);

CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  access_token TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version_id TEXT NOT NULL REFERENCES template_versions(id),
  status TEXT NOT NULL,
  credits_charged INTEGER NOT NULL DEFAULT 1,
  upload_asset_id TEXT,
  upload_r2_key TEXT,
  output_asset_id TEXT,
  output_r2_key TEXT,
  fal_request_id TEXT,
  fal_status_url TEXT,
  fal_response_url TEXT,
  workflow_instance_id TEXT,
  error_code TEXT,
  error_message TEXT,
  refund_status TEXT NOT NULL DEFAULT 'none',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_jobs_token ON generation_jobs(access_token, created_at DESC);
CREATE INDEX idx_jobs_fal ON generation_jobs(fal_request_id);
CREATE INDEX idx_jobs_status ON generation_jobs(status, updated_at);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  wallet_id TEXT,
  access_token TEXT,
  kind TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes INTEGER,
  retain_until INTEGER NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_assets_token ON assets(access_token, kind);

CREATE TABLE refund_requests (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES generation_jobs(id),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  status TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
