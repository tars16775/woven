#!/bin/bash
# Try Woven on this Mac with nothing installed system-wide: no launchd, no
# Keychain, no PATH changes. Builds the Core and the dashboard from this
# checkout, keeps data in a folder you can delete, and runs in the foreground
# until Ctrl-C.
#
#   packaging/try.sh              # build and run
#   packaging/try.sh --seed       # also seed the demo household (Alex, Maya, Sam)
#   WOVEN_DATA=/tmp/woven-try packaging/try.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${WOVEN_DATA:-$HOME/Library/Application Support/Woven Try}"
SEED=""
for arg in "$@"; do case "$arg" in --seed) SEED=1 ;; esac; done

say() { printf '\033[1m%s\033[0m\n' "$*"; }
command -v node >/dev/null || { echo "Node 22 is needed (https://nodejs.org)."; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is needed: corepack enable"; exit 1; }

if [ ! -d "$ROOT/node_modules" ]; then say "Installing dependencies..."; (cd "$ROOT" && pnpm install --prefer-offline); fi
if [ ! -f "$ROOT/apps/core/dist/server.js" ] || [ -n "${WOVEN_REBUILD:-}" ]; then say "Building the Core..."; (cd "$ROOT/apps/core" && pnpm exec tsup >/dev/null); fi
if [ ! -f "$ROOT/apps/web/out-build/index.html" ] || [ -n "${WOVEN_REBUILD:-}" ]; then
  say "Building the dashboard (a few minutes the first time)..."
  (cd "$ROOT/apps/web" && WOVEN_STATIC=1 NEXT_PUBLIC_WOVEN_LIVE=on pnpm exec next build >/dev/null)
fi

mkdir -p "$DATA"
export NODE_ENV=production WOVEN_DATA="$DATA" WOVEN_KEY=file WOVEN_SITE="$ROOT/apps/web/out-build" WOVEN_MDNS="${WOVEN_MDNS:-on}" LOG_LEVEL="${LOG_LEVEL:-info}"
export WOVEN_ORIGINS="${WOVEN_ORIGINS:-https://woven.local:4000,https://localhost:4000,http://localhost:4002,http://localhost:3000}"
cd "$ROOT/apps/core"
if [ -n "$SEED" ]; then say "Seeding the demo household..."; node --experimental-strip-types src/cli/seed.ts 2>/dev/null || pnpm exec tsx src/cli/seed.ts; fi

say "Woven is starting. Data: $DATA (the key is in keys/data.key there, not the Keychain)."
echo "  Dashboard on this Mac:  http://localhost:4002/signup   (or /login once a house exists)"
echo "  Other devices at home:  open http://woven.local:4001 once to trust the certificate, then https://woven.local:4000"
echo "  Stop with Ctrl-C. Delete the data folder to start over."
exec node dist/server.js
