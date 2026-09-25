#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/companion/reference-node/public"
DST="$ROOT/companion/embedded/public"
mkdir -p "$DST"
cp "$SRC/index.html" "$SRC/app.js" "$SRC/studio.js" "$SRC/studio-i18n.js" "$SRC/stream-builders.js" "$SRC/i18n.js" "$SRC/native-pages.js" "$SRC/logo.svg" "$SRC/styles.css" "$DST/"
echo "Embedded UI synced from reference UI."
