#!/usr/bin/env bash
# Upload template media to the remote R2 bucket (Cloudflare).
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (or wrangler login).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUCKET="${R2_BUCKET_NAME:-riding-lion-private}"
PREFIX="templates/turn-smile/v1"
SRC_DIR="assets/templates/turn-smile/v1"
TPL="assets/riding-lion-tpl.mp4"

mkdir -p "$SRC_DIR"
if [[ ! -f "$SRC_DIR/source.mp4" ]]; then
  [[ -f "$TPL" ]] || { echo "Missing $TPL"; exit 1; }
  cp "$TPL" "$SRC_DIR/source.mp4"
fi
# Distinct verified render only — never clone the plate as “sample output”
if [[ -f assets/sample-output.mp4 ]]; then
  cp -f assets/sample-output.mp4 "$SRC_DIR/sample-output.mp4"
fi
if [[ ! -f "$SRC_DIR/sample-photo.jpg" && -f assets/default-person.jpg ]]; then
  cp assets/default-person.jpg "$SRC_DIR/sample-photo.jpg"
fi
if [[ ! -f "$SRC_DIR/cover.jpg" && -f "$SRC_DIR/sample-photo.jpg" ]]; then
  cp "$SRC_DIR/sample-photo.jpg" "$SRC_DIR/cover.jpg"
fi

put() {
  local key="$1" file="$2" ctype="$3"
  [[ -f "$file" ]] || { echo "skip missing $file"; return 0; }
  echo "R2 put $BUCKET/$key"
  npx wrangler r2 object put "${BUCKET}/${key}" --file "$file" --content-type "$ctype" --remote
}

put "${PREFIX}/source.mp4" "$SRC_DIR/source.mp4" "video/mp4"
if [[ -f "$SRC_DIR/sample-output.mp4" ]]; then
  put "${PREFIX}/sample-output.mp4" "$SRC_DIR/sample-output.mp4" "video/mp4"
fi
put "${PREFIX}/sample-photo.jpg" "$SRC_DIR/sample-photo.jpg" "image/jpeg"
put "${PREFIX}/cover.jpg" "$SRC_DIR/cover.jpg" "image/jpeg"

echo "Remote R2 seed complete."
