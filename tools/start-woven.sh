#!/bin/zsh
# Start Woven on this Mac: mount the Woven volume, start the site (and the
# core service once it exists), and open the dashboard. Idempotent.
set -euo pipefail

IMAGE="/Volumes/LaCie/Woven.sparsebundle"
MOUNT="/Volumes/Woven"
REPO="$MOUNT/Woven"
WEB="$REPO/apps/web"
LOGS="$MOUNT/Woven Data/logs"
mkdir -p "$LOGS" 2>/dev/null || true

if [ ! -d "$MOUNT/Woven" ]; then
  echo "Mounting the Woven volume…"
  hdiutil attach -mountpoint "$MOUNT" "$IMAGE" >/dev/null
fi

export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:$PATH"

if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Site already running on http://localhost:3000"
else
  echo "Starting the site…"
  (cd "$WEB" && nohup pnpm dev --port 3000 >"$LOGS/web.log" 2>&1 &)
  for i in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:3000; then break; fi
    sleep 1
  done
fi

# The core service (apps/core) starts here once it exists.
if [ -d "$REPO/apps/core" ]; then
  if ! lsof -iTCP:4000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Starting Woven Core…"
    (cd "$REPO/apps/core" && WOVEN_DATA="$MOUNT/Woven Data" nohup pnpm start >"$LOGS/core.log" 2>&1 &)
  fi
fi

echo "Ready."
open "http://localhost:3000/dashboard"
