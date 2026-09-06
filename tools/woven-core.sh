#!/bin/bash
# Supervises the Woven Core: runs it, and starts it again when it asks
# (exit code 75, the dashboard's Restart) or crashes. A clean exit stops.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO/apps/core"
while true; do
  pnpm exec tsx src/server.ts
  code=$?
  if [ "$code" -eq 0 ]; then exit 0; fi
  if [ "$code" -eq 75 ]; then echo "core asked for a restart"; sleep 1; continue; fi
  echo "core exited with $code; starting again in 5 s"
  sleep 5
done
