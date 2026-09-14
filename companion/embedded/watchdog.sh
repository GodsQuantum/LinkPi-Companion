#!/bin/sh
set -u
BASE=/link/config/autodirector
PHP=/usr/php/bin/php
VERSION_FILE="$BASE/VERSION"
RUNTIME_VERSION_FILE=/tmp/autodirector-version

VERSION="unknown"
[ -r "$VERSION_FILE" ] && VERSION=$(cat "$VERSION_FILE" 2>/dev/null)

if [ "$(cat "$RUNTIME_VERSION_FILE" 2>/dev/null)" != "$VERSION" ]; then
  for PIDFILE in /tmp/autodirector-worker.pid /tmp/autodirector-web.pid; do
    PID=$(cat "$PIDFILE" 2>/dev/null) || true
    [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
    rm -f "$PIDFILE"
  done
  printf '%s\n' "$VERSION" > "$RUNTIME_VERSION_FILE"
fi

alive() {
  PIDFILE="$1"
  MARKER="$2"
  [ -r "$PIDFILE" ] || return 1
  PID=$(cat "$PIDFILE" 2>/dev/null) || return 1
  kill -0 "$PID" 2>/dev/null || return 1
  tr '\000' ' ' < "/proc/$PID/cmdline" 2>/dev/null | grep -F "$MARKER" >/dev/null 2>&1
}

if ! alive /tmp/autodirector-worker.pid 'autodirector/worker.php'; then
  nohup "$PHP" "$BASE/worker.php" >>/tmp/autodirector-worker.log 2>&1 &
  echo $! >/tmp/autodirector-worker.pid
fi

if ! alive /tmp/autodirector-web.pid '0.0.0.0:8787'; then
  nohup "$PHP" -S 0.0.0.0:8787 -t "$BASE/public" "$BASE/router.php" >>/tmp/autodirector-web.log 2>&1 &
  echo $! >/tmp/autodirector-web.pid
fi
