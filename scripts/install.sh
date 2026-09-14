#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMBEDDED="$ROOT/companion/embedded"
TARGET="${1:-192.168.1.217}"
BASE_URL="${LINKPI_URL:-http://$TARGET}"
UI_PORT="8787"
RESET_HARDWARE="${RESET_HARDWARE:-0}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 2
  }
}
need curl
need python3

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STAGE="$TMP/stage"
mkdir -p "$STAGE/autodirector/public" "$STAGE/auto"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backups/$TARGET/$STAMP"
mkdir -p "$BACKUP"

echo "LinkPi target: $BASE_URL"
echo "Backup: $BACKUP"
curl -fsS --connect-timeout 3 --max-time 6 "$BASE_URL/" >/dev/null

fetch_optional() {
  local remote="$1" local_path="$2"
  if curl -fsS --connect-timeout 2 --max-time 6 "$BASE_URL/$remote" -o "$local_path"; then
    echo "Backed up: $remote"
    return 0
  fi
  rm -f "$local_path"
  return 1
}

fetch_optional config/auto/root.cron "$BACKUP/root.cron" || true
fetch_optional config/autodirector/hardware.json "$BACKUP/hardware.json" || true
fetch_optional config/autodirector/settings.json "$BACKUP/settings.json" || true
fetch_optional config/version.json "$BACKUP/version.json" || true

for name in lib.php companion.php worker.php router.php test.php watchdog.sh VERSION; do
  cp "$EMBEDDED/$name" "$STAGE/autodirector/$name"
done
cp "$EMBEDDED/public/"* "$STAGE/autodirector/public/"

if [[ "$RESET_HARDWARE" != "1" && -s "$BACKUP/hardware.json" ]]; then
  cp "$BACKUP/hardware.json" "$STAGE/autodirector/hardware.json"
  echo "Preserving existing hardware/calibration config."
else
  cp "$EMBEDDED/hardware.example.json" "$STAGE/autodirector/hardware.json"
  echo "Installing safe uncalibrated hardware template."
fi

if [[ -s "$BACKUP/settings.json" ]]; then
  cp "$BACKUP/settings.json" "$STAGE/autodirector/settings.json"
  echo "Preserving existing editorial settings."
fi

CRON="$STAGE/auto/root.cron"
if [[ -s "$BACKUP/root.cron" ]]; then
  grep -vF '/link/config/autodirector/watchdog.sh' "$BACKUP/root.cron" > "$CRON" || true
else
  : > "$CRON"
fi
printf '%s\n' '* * * * * /bin/sh /link/config/autodirector/watchdog.sh' >> "$CRON"

PACKAGE="$TMP/linkpi-companion-install.zip"
python3 - "$STAGE" "$PACKAGE" <<'PY'
from pathlib import Path
import sys, zipfile
root = Path(sys.argv[1])
out = Path(sys.argv[2])
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(root))
print(f"Package: {out} ({out.stat().st_size} bytes)")
PY

echo "Uploading through LinkPi config restore API..."
RESPONSE="$(curl -fsS --connect-timeout 3 --max-time 30 \
  -F "file=@$PACKAGE" "$BASE_URL/link/upd/uploadConf.php")"
echo "$RESPONSE"
python3 - "$RESPONSE" <<'PY'
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception as exc:
    raise SystemExit(f"Invalid upload response: {exc}")
if data.get('isSuccess') is not True:
    raise SystemExit('LinkPi rejected the deployment package')
PY

UI_URL="http://$TARGET:$UI_PORT"
echo "Waiting for LinkPi Companion at $UI_URL ..."
for _ in $(seq 1 24); do
  if STATE="$(curl -fsS --connect-timeout 2 --max-time 4 "$UI_URL/api/state" 2>/dev/null)"; then
    echo "LinkPi Companion is online."
    python3 - "$STATE" <<'PY'
import json, sys
s = json.loads(sys.argv[1])
print('mode:', s.get('mode'))
print('scene:', s.get('scene'))
print('rpc:', s.get('health', {}).get('rpc'))
print('autoReady:', s.get('readiness', {}).get('autoReady'))
print('worker pid:', s.get('worker', {}).get('pid'))
PY
    echo "UI: $UI_URL"
    exit 0
  fi
  sleep 5
done

echo "Deployment uploaded but UI did not become reachable within 120s." >&2
echo "Check: $BASE_URL/config/auto/root.cron" >&2
exit 1
