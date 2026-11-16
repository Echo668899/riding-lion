#!/usr/bin/env bash
# Smoke acceptance against a running wrangler dev (default http://127.0.0.1:8787)
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"

echo "== health =="
curl -fsS "$BASE/api/health" | tee /tmp/rl-health.json
echo

echo "== catalog =="
curl -fsS "$BASE/api/catalog" | tee /tmp/rl-catalog.json
echo

# 1x1 jpeg
IMG=/tmp/rl-photo.jpg
python3 - <<'PY'
from pathlib import Path
Path("/tmp/rl-photo.jpg").write_bytes(bytes.fromhex(
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c2132323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103011100021101031101ffc40014000100000000000000000000000000000008ffc4001410010000000000000000000000000000000000ffda000c0301000210031000003f00bf80ffd9"
))
PY

echo "== upload =="
UP=$(curl -fsS -F "file=@${IMG};type=image/jpeg" "$BASE/api/uploads")
echo "$UP" | tee /tmp/rl-upload.json
TOKEN=$(python3 -c 'import json;print(json.load(open("/tmp/rl-upload.json"))["accessToken"])')
ASSET=$(python3 -c 'import json;print(json.load(open("/tmp/rl-upload.json"))["assetId"])')

echo "== checkout pack_3 =="
IDEMP="smoke_$(date +%s)"
CH=$(curl -fsS -H 'content-type: application/json' \
  -d "{\"packId\":\"pack_3\",\"accessToken\":\"$TOKEN\",\"idempotencyKey\":\"$IDEMP\"}" \
  "$BASE/api/payments/checkout")
echo "$CH" | tee /tmp/rl-checkout.json
PAY=$(python3 -c 'import json;print(json.load(open("/tmp/rl-checkout.json"))["paymentId"])')

echo "== cancel then re-checkout / confirm (cancel path) =="
curl -fsS -H 'content-type: application/json' -d "{\"paymentId\":\"$PAY\"}" "$BASE/api/payments/mock/cancel" || true

IDEMP2="smoke_pay_$(date +%s)"
CH2=$(curl -fsS -H 'content-type: application/json' \
  -d "{\"packId\":\"pack_3\",\"accessToken\":\"$TOKEN\",\"idempotencyKey\":\"$IDEMP2\"}" \
  "$BASE/api/payments/checkout")
PAY2=$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])["paymentId"])' "$CH2")

echo "== simulate pay =="
curl -fsS -H 'content-type: application/json' -d "{\"paymentId\":\"$PAY2\"}" "$BASE/api/payments/mock/confirm" | tee /tmp/rl-paid.json

echo "== duplicate payment webhook =="
curl -fsS -H 'content-type: application/json' \
  -d "{\"event\":\"payment.paid\",\"paymentId\":\"$PAY2\",\"providerEventId\":\"dup_$PAY2\",\"credits\":3,\"amountCents\":1999}" \
  "$BASE/api/webhooks/payment" | tee /tmp/rl-dup.json

echo "== wallet email =="
curl -fsS -H 'content-type: application/json' \
  -d "{\"accessToken\":\"$TOKEN\",\"email\":\"smoke@ridinglion.com\"}" \
  "$BASE/api/wallet/email" | tee /tmp/rl-email.json

echo "== generate =="
JOB=$(curl -fsS -H 'content-type: application/json' \
  -d "{\"accessToken\":\"$TOKEN\",\"assetId\":\"$ASSET\",\"email\":\"smoke@ridinglion.com\"}" \
  "$BASE/api/generations")
echo "$JOB" | tee /tmp/rl-job.json
JOBID=$(python3 -c 'import json;print(json.load(open("/tmp/rl-job.json"))["jobId"])')

echo "== resend inbound webhook (store only) =="
curl -fsS -H 'content-type: application/json' \
  -d '{"type":"email.received","data":{"email_id":"smoke_inb_1","from":"user@example.com","to":["support@ridinglion.com"],"subject":"Help"}}' \
  "$BASE/api/webhooks/resend" | tee /tmp/rl-resend-webhook.json

echo "== poll job =="
for i in $(seq 1 20); do
  ST=$(curl -fsS "$BASE/api/generations/$JOBID?accessToken=$TOKEN")
  echo "$ST" > /tmp/rl-job-status.json
  STATUS=$(python3 -c 'import json;print(json.load(open("/tmp/rl-job-status.json"))["status"])')
  echo "status=$STATUS"
  if [[ "$STATUS" == "succeeded" || "$STATUS" == "failed" || "$STATUS" == "storage_failed" ]]; then
    break
  fi
  sleep 1
done

echo "== session recover =="
curl -fsS "$BASE/api/session/$TOKEN" | tee /tmp/rl-session.json
echo
echo "Smoke finished. Inspect /tmp/rl-*.json"
