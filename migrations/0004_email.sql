ALTER TABLE wallets ADD COLUMN email TEXT;
ALTER TABLE wallets ADD COLUMN email_updated_at INTEGER;

ALTER TABLE generation_jobs ADD COLUMN notify_email TEXT;
ALTER TABLE generation_jobs ADD COLUMN notify_email_sent_at INTEGER;
ALTER TABLE generation_jobs ADD COLUMN notify_email_id TEXT;

CREATE TABLE inbound_emails (
  id TEXT PRIMARY KEY,
  resend_email_id TEXT NOT NULL UNIQUE,
  from_addr TEXT,
  to_addrs TEXT,
  subject TEXT,
  message_id TEXT,
  received_at INTEGER NOT NULL,
  raw_json TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_wallets_email ON wallets(email);
CREATE INDEX idx_jobs_notify ON generation_jobs(notify_email);
