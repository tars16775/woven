#!/bin/sh
# Every start is a fresh example house. Whatever visitors did since the last
# start is gone, which is the point: nobody's demo becomes anybody's record.
set -eu
rm -rf "${WOVEN_DATA:?}"/* 2>/dev/null || true
mkdir -p "$WOVEN_DATA"
node dist/seed.js
exec node dist/server.js
