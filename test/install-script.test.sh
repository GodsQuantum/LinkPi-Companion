#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/install.sh"

grep -q 'settings.json' "$SCRIPT"
grep -q 'Preserving existing editorial settings' "$SCRIPT"
grep -q 'cp "$BACKUP/settings.json" "$STAGE/autodirector/settings.json"' "$SCRIPT"

echo "PASS installer preserves editorial settings"
grep -q 'companion.php' "$SCRIPT"
grep -q 'public/"\*' "$SCRIPT"
echo "PASS installer packages Companion runtime and UI"
