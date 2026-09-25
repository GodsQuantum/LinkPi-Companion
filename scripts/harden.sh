#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-192.168.1.217}"
BASE_URL="${LINKPI_URL:-http://$TARGET}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT/backups}"
NTP_SERVER="${NTP_SERVER:-fr.pool.ntp.org}"

for cmd in curl python3; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing dependency: $cmd" >&2; exit 2; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_ROOT/$TARGET/$STAMP-hardening"
mkdir -p "$BACKUP"

echo "LinkPi target: $BASE_URL"
echo "Backup: $BACKUP"
curl -fsS --connect-timeout 3 --max-time 6 "$BASE_URL/config/service.json" -o "$BACKUP/service.json"
curl -fsS --connect-timeout 3 --max-time 6 "$BASE_URL/config/ntp.json" -o "$BACKUP/ntp.json"
python3 - "$BASE_URL" "$NTP_SERVER" <<'PY'
import json, sys, urllib.request
base, ntp_server = sys.argv[1:]
with urllib.request.urlopen(base.rstrip('/') + '/config/service.json', timeout=6) as response:
    current_service=json.loads(response.read().decode())
preserve_sls=current_service.get('sls', False) is True
relay = base.rstrip('/') + '/link/relay.php'
changes = [
    ('/conf/updateServiceConf', {
        'telnet': False, 'ssh': True, 'php': True, 'nginx': True,
        'crond': True, 'onvif': False, 'ndi': False, 'sls': preserve_sls,
        'frp': False, 'trans': False,
    }),
    ('/conf/updateNtpConf', {
        'enable': True, 'server': ntp_server, 'interval': 5,
    }),
]
for url, data in changes:
    payload=json.dumps({'url':url,'data':data}).encode()
    req=urllib.request.Request(relay, data=payload, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=10) as response:
        result=json.loads(response.read().decode())
    if result.get('status') != 'success':
        raise SystemExit(f'{url} failed: {result}')
    print(f'Applied: {url}')
PY
SERVICE="$(curl -fsS --connect-timeout 3 --max-time 6 "$BASE_URL/config/service.json")"
NTP="$(curl -fsS --connect-timeout 3 --max-time 6 "$BASE_URL/config/ntp.json")"
python3 - "$SERVICE" "$NTP" "$NTP_SERVER" "$BACKUP/service.json" <<'PY'
import json, sys
svc=json.loads(sys.argv[1]); ntp=json.loads(sys.argv[2]); server=sys.argv[3]
before=json.load(open(sys.argv[4]))
expected={'telnet':False,'ssh':True,'php':True,'nginx':True,'crond':True,
          'onvif':False,'ndi':False,'sls':before.get('sls',False) is True,'frp':False,'trans':False}
for key, value in expected.items():
    if svc.get(key) is not value:
        raise SystemExit(f'service verification failed: {key}={svc.get(key)!r}')
if ntp.get('enable') is not True or ntp.get('server') != server or ntp.get('interval') != 5:
    raise SystemExit(f'NTP verification failed: {ntp}')
print('Verified service policy and NTP config.')
PY

echo "Hardening config saved."
echo "A normal LinkPi reboot is required for already-running daemons such as Telnet to stop."
echo "No reboot was triggered automatically."
