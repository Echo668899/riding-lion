#!/usr/bin/env bash
# One-time Cloudflare resource bootstrap. Run locally after `npx wrangler login`.
# Creates D1 + R2 (if missing) and prints the database_id to paste into wrangler.jsonc.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${D1_NAME:-riding-lion}"
BUCKET="${R2_BUCKET_NAME:-riding-lion-private}"

echo "== create D1 database: $DB_NAME =="
CREATE_OUT="$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)"
echo "$CREATE_OUT"
DB_ID="$(echo "$CREATE_OUT" | sed -n 's/.*"database_id": *"\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$DB_ID" ]]; then
  DB_ID="$(echo "$CREATE_OUT" | sed -n 's/.*database_id *= *"\([^"]*\)".*/\1/p' | head -1)"
fi
if [[ -z "$DB_ID" ]]; then
  echo "If the DB already exists, copy database_id from: npx wrangler d1 list"
fi

echo
echo "== create R2 bucket: $BUCKET =="
npx wrangler r2 bucket create "$BUCKET" 2>&1 || echo "(bucket may already exist)"

echo
echo "Update wrangler.jsonc:"
echo "  d1_databases[0].database_id = \"$DB_ID\""
echo "  r2_buckets[0].bucket_name = \"$BUCKET\""
echo
echo "Then: npm run db:migrate:remote && bash scripts/seed-remote-assets.sh && npm run deploy"
