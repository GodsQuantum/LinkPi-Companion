#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'kill ${MOCK_PID:-0} 2>/dev/null || true; rm -rf "$TMP"' EXIT

python3 "$ROOT/test/mock-linkpi.py" "$TMP/calls.json" > "$TMP/port" &
MOCK_PID=$!
for _ in $(seq 1 50); do [[ -s "$TMP/port" ]] && break; sleep 0.05; done
PORT="$(cat "$TMP/port")"

BACKUP_ROOT="$TMP/backups" LINKPI_URL="http://127.0.0.1:$PORT" \
  "$ROOT/scripts/harden.sh" test-target > "$TMP/output"

python3 - "$TMP/calls.json" <<'PY'
import json, sys
calls=json.load(open(sys.argv[1]))
assert [c['url'] for c in calls] == ['/conf/updateServiceConf','/conf/updateNtpConf']
svc=calls[0]['data']; ntp=calls[1]['data']
assert svc == {'telnet':False,'ssh':True,'php':True,'nginx':True,'crond':True,'onvif':False,'ndi':False,'sls':False,'frp':False,'trans':False}
assert ntp == {'enable':True,'server':'fr.pool.ntp.org','interval':5}
assert all(c['url'] != '/system/systemReboot' for c in calls)
print('PASS harden script applies safe service/NTP policy without reboot')
PY
