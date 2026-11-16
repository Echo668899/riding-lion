#!/usr/bin/env bash
# Seed template objects into local R2.
# Primary plate: assets/riding-lion-tpl.mp4
# Default person: assets/default-person.jpg (extracted from template if missing)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/assets/templates/turn-smile/v1"
TPL="$ROOT/assets/riding-lion-tpl.mp4"
PERSON="$ROOT/assets/default-person.jpg"
mkdir -p "$DIR"

if [[ ! -f "$TPL" ]]; then
  echo "Missing template video: $TPL" >&2
  exit 1
fi

cp -f "$TPL" "$DIR/source.mp4"
cp -f "$TPL" "$DIR/sample-output.mp4"

if [[ -f "$PERSON" ]]; then
  cp -f "$PERSON" "$DIR/sample-photo.jpg"
fi

if [[ ! -f "$DIR/cover.jpg" || ! -f "$DIR/sample-photo.jpg" ]]; then
  echo "Tip: place assets/default-person.jpg (and optional cover.jpg) before seeding."
fi

# Tiny JPEG fallback only if still missing
python3 - "$DIR" <<'PY'
from pathlib import Path
import sys
base = Path(sys.argv[1])
jpeg = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c"
    "1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d"
    "0d1832211c2132323232323232323232323232323232323232323232323232323232"
    "3232323232323232323232323232323232323232ffc0001108000100010301110002"
    "1101031101ffc40014000100000000000000000000000000000008ffc40014100100"
    "00000000000000000000000000000000ffda000c0301000210031000003f00bf80ffd9"
)
for name in ("cover.jpg", "sample-photo.jpg"):
    p = base / name
    if not p.exists() or p.stat().st_size < 1000:
        if not p.exists():
            p.write_bytes(jpeg)
print("Asset files ready under", base)
PY

put() {
  local key="$1"
  local file="$2"
  local ctype="$3"
  echo "Putting $key"
  npx wrangler r2 object put "riding-lion-private/$key" --file "$file" --local --content-type "$ctype"
}

put "templates/turn-smile/v1/source.mp4" "$DIR/source.mp4" "video/mp4"
put "templates/turn-smile/v1/sample-output.mp4" "$DIR/sample-output.mp4" "video/mp4"
put "templates/turn-smile/v1/cover.jpg" "$DIR/cover.jpg" "image/jpeg"
put "templates/turn-smile/v1/sample-photo.jpg" "$DIR/sample-photo.jpg" "image/jpeg"

echo "Done. Template: assets/riding-lion-tpl.mp4 · Person: assets/default-person.jpg"
