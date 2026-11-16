-- Passwordless email login helpers
CREATE INDEX IF NOT EXISTS idx_wallets_email_lookup ON wallets(email);

CREATE TABLE IF NOT EXISTS login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email, created_at DESC);
