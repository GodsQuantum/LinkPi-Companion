#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-192.168.1.217}"
URL="http://$TARGET:8787/api/state"
STATE="$(curl -fsS --connect-timeout 3 --max-time 6 "$URL")"
python3 - "$STATE" <<'PY'
import json, sys
s = json.loads(sys.argv[1])
r = s.get('readiness', {})
h = s.get('health', {})
sysstate = s.get('telemetry', {}).get('system') or {}
print(f"Mode       : {s.get('mode')}")
print(f"Scene      : {s.get('scene')}")
print(f"RPC        : {h.get('rpc')}")
print(f"AUTO ready : {r.get('autoReady')}")
print(f"Video ready: {r.get('videoReady')}")
print(f"Meters     : {r.get('detectorsReady')}")
print(f"Calibration: {r.get('calibrationReady')}")
print(f"Scenes     : {r.get('scenesReady')}")
print(f"CPU/RAM/T° : {sysstate.get('cpu')}% / {sysstate.get('mem')}% / {sysstate.get('temperature')}°C")
print(f"Worker PID : {s.get('worker', {}).get('pid')}")
PY
