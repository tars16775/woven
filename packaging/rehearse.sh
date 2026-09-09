#!/bin/bash
# Rehearse a real install on a clean machine, without being one.
#
#   packaging/rehearse.sh
#
# Everything a first-time household does, in a sandbox: build a release, sign
# it with a throwaway key, verify the signature, refuse a tampered one,
# install into an empty HOME, update to a second version, and roll back.
#
# Why this exists. Every other path in Woven has a test. The install and
# update path did not, because it is the one that does not run here: it runs
# unattended on somebody else's Mac, weeks after we stopped looking, and if it
# is wrong the household has no dashboard to tell them so. This is the closest
# thing to a rehearsal that does not need a second machine.
#
# What it deliberately does NOT do:
#   * touch launchd (WOVEN_NO_LAUNCHD keeps every file inside the sandbox)
#   * touch the login Keychain (the Core keeps its key in a file here)
#   * touch the real release key (a throwaway pair is made per run and dies
#     with the sandbox; the real private key belongs only to the maintainer)
#   * touch your shell profile, your data, or ~/.woven
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# The sandbox unpacks a private Node runtime and two releases, so it wants a
# few hundred megabytes. Default it beside the checkout rather than into the
# startup disk's temp, which on a Mac with a small boot volume is exactly the
# wrong place to put something this size.
SANDBOX_BASE="${WOVEN_REHEARSAL_BASE:-$(cd "$(dirname "$0")/../.." && pwd)/tmp}"
mkdir -p "$SANDBOX_BASE" 2>/dev/null || SANDBOX_BASE="${TMPDIR:-/tmp}"
SANDBOX="${WOVEN_REHEARSAL_DIR:-$(mktemp -d "$SANDBOX_BASE/woven-rehearse.XXXXXX")}"
KEEP="${WOVEN_REHEARSAL_KEEP:-}"
PASS=0
FAIL=0

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; PASS=$((PASS + 1)); }
no() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else no "$1"; fi; }

cleanup() {
  if [ -n "$KEEP" ]; then
    echo "Sandbox kept at $SANDBOX"
  else
    rm -rf "$SANDBOX"
  fi
}
trap cleanup EXIT

FAKE_HOME="$SANDBOX/home"
mkdir -p "$FAKE_HOME"
export HOME="$FAKE_HOME"
export WOVEN_HOME="$FAKE_HOME/.woven"
export WOVEN_DATA="$FAKE_HOME/Library/Application Support/Woven"
export WOVEN_NO_LAUNCHD=1
export WOVEN_NO_OPEN=1
export WOVEN_KEY=file

say "Rehearsing in $SANDBOX"

# ---------------------------------------------------------------- the key ---
# A throwaway signing pair, made here and never leaving. It stands in for the
# real release key so the signature path is exercised without anyone but the
# maintainer ever holding the real private half.
say "1. A throwaway release key"
node -e '
  const { generateKeyPairSync } = require("node:crypto");
  const { writeFileSync } = require("node:fs");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  writeFileSync(process.argv[1], privateKey.export({ type: "pkcs8", format: "pem" }));
  writeFileSync(process.argv[2], publicKey.export({ type: "spki", format: "pem" }));
' "$SANDBOX/key.pem" "$SANDBOX/key.pub"
chmod 600 "$SANDBOX/key.pem"
check "a keypair was made" "[ -s '$SANDBOX/key.pem' ] && [ -s '$SANDBOX/key.pub' ]"

# ------------------------------------------------------------ the release ---
say "2. A signed release"
if [ -n "${WOVEN_REHEARSAL_TARBALL:-}" ]; then
  cp "$WOVEN_REHEARSAL_TARBALL" "$SANDBOX/woven-macos.tar.gz"
  echo "  (reusing $WOVEN_REHEARSAL_TARBALL)"
else
  ( cd "$ROOT" && WOVEN_RELEASE_KEY="" bash packaging/release.sh >"$SANDBOX/release.log" 2>&1 ) || {
    no "release.sh failed; see $SANDBOX/release.log"; echo; exit 1;
  }
  cp "$ROOT/release/woven-macos.tar.gz" "$SANDBOX/woven-macos.tar.gz"
fi
check "a tarball exists" "[ -s '$SANDBOX/woven-macos.tar.gz' ]"

WOVEN_RELEASE_KEY="$(cat "$SANDBOX/key.pem")" node "$ROOT/packaging/sign.mjs" "$SANDBOX/woven-macos.tar.gz" >/dev/null
check "it is signed" "[ -s '$SANDBOX/woven-macos.tar.gz.sig' ]"
verify_exit() {
  # 0 verified, 1 refused, 2 called wrongly. The third is a bug in this script
  # and must never be mistaken for the second.
  node "$ROOT/packaging/verify.mjs" "$1" "$1.sig" "$SANDBOX/key.pub" >/dev/null 2>&1
  echo $?
}
rc=$(verify_exit "$SANDBOX/woven-macos.tar.gz")
if [ "$rc" = "0" ]; then ok "a good signature verifies"; else no "a good signature was refused (exit $rc)"; fi

# The whole point of signing: a changed byte must be caught.
cp "$SANDBOX/woven-macos.tar.gz" "$SANDBOX/tampered.tar.gz"
cp "$SANDBOX/woven-macos.tar.gz.sig" "$SANDBOX/tampered.tar.gz.sig"
printf 'x' >>"$SANDBOX/tampered.tar.gz"
rc=$(verify_exit "$SANDBOX/tampered.tar.gz")
case "$rc" in
  0) no "a tampered release was ACCEPTED" ;;
  1) ok "a tampered release is refused" ;;
  *) no "the tamper check did not run (exit $rc)" ;;
esac

# A signature from a different key must also be caught.
node -e '
  const { generateKeyPairSync } = require("node:crypto");
  const { writeFileSync } = require("node:fs");
  const { privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(process.argv[1], privateKey.export({ type: "pkcs8", format: "pem" }));
' "$SANDBOX/other.pem"
cp "$SANDBOX/woven-macos.tar.gz" "$SANDBOX/wrongkey.tar.gz"
WOVEN_RELEASE_KEY="$(cat "$SANDBOX/other.pem")" node "$ROOT/packaging/sign.mjs" "$SANDBOX/wrongkey.tar.gz" >/dev/null
rc=$(verify_exit "$SANDBOX/wrongkey.tar.gz")
case "$rc" in
  0) no "a release signed by another key was ACCEPTED" ;;
  1) ok "a release signed by another key is refused" ;;
  *) no "the wrong-key check did not run (exit $rc)" ;;
esac

# ------------------------------------------------------------ the install ---
say "3. Installing into an empty home"
# The installer embeds the trust root; put the throwaway public key where the
# placeholder is, in a copy, so the real script in the repository is untouched.
INSTALLER="$SANDBOX/install.sh"
python3 - "$ROOT/packaging/install.sh" "$SANDBOX/key.pub" "$INSTALLER" <<'PY'
import sys
src, pub, out = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src).read()
key = open(pub).read().strip()
if "__WOVEN_RELEASE_PUB__" in text:
    text = text.replace("__WOVEN_RELEASE_PUB__", key)
open(out, "w").write(text)
PY

WOVEN_RELEASE_FILE="$SANDBOX/woven-macos.tar.gz" bash "$INSTALLER" >"$SANDBOX/install.log" 2>&1 || {
  no "install.sh failed; see $SANDBOX/install.log"; tail -20 "$SANDBOX/install.log"; echo; exit 1;
}
ok "install.sh finished"
check "the program is in place" "[ -x '$WOVEN_HOME/bin/woven' ]"
check "a private Node was fetched" "[ -x '$WOVEN_HOME/node/bin/node' ]"
check "a release was unpacked" "ls '$WOVEN_HOME/releases' | grep -q ."
check "current points at it" "[ -L '$WOVEN_HOME/current' ] || [ -d '$WOVEN_HOME/current' ]"
check "configuration was written" "[ -f '$WOVEN_HOME/config.env' ]"
check "the data folder was made" "[ -d '$WOVEN_DATA' ]"
check "nothing was written to the real home" "[ ! -e \"\${REAL_HOME:-/nonexistent}/.woven/config.env.rehearsal\" ]"
check "no launch agent outside the sandbox" "[ ! -f '$FAKE_HOME/Library/LaunchAgents/com.woven.core.plist' ] || grep -q '$SANDBOX' '$FAKE_HOME/Library/LaunchAgents/com.woven.core.plist'"

# --------------------------------------------------------------- it runs ----
say "4. It starts and answers"
PORT=4400
export PATH="$WOVEN_HOME/node/bin:$PATH"
(
  cd "$WOVEN_HOME/current"
  WOVEN_DATA="$WOVEN_DATA" WOVEN_TLS=off WOVEN_MDNS=off WOVEN_PORT=$PORT WOVEN_HOST=127.0.0.1 \
    WOVEN_LOCAL_PORT=0 WOVEN_TRUST_PORT=$((PORT + 1)) WOVEN_GATE=off WOVEN_KEY=file NODE_ENV=production LOG_LEVEL=warn \
    "$WOVEN_HOME/node/bin/node" dist/server.js >"$SANDBOX/core.log" 2>&1 &
  echo $! >"$SANDBOX/core.pid"
)
started=""
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/v1/health"; then started=1; break; fi
  sleep 2
done
if [ -n "$started" ]; then
  ok "the packaged Core answers /v1/health"
  version="$(curl -s "http://127.0.0.1:$PORT/v1/health" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).version' 2>/dev/null || echo "?")"
  echo "     version $version"
else
  no "the packaged Core never answered; see $SANDBOX/core.log"
  tail -20 "$SANDBOX/core.log" || true
fi
[ -f "$SANDBOX/core.pid" ] && kill "$(cat "$SANDBOX/core.pid")" 2>/dev/null || true
sleep 1

# ---------------------------------------------------------- update, back ----
say "5. Updating, and rolling back"
before="$(readlink "$WOVEN_HOME/current" 2>/dev/null || basename "$(ls -d "$WOVEN_HOME"/releases/* | head -1)")"
# A second release, distinguishable from the first.
NEXT="$SANDBOX/next"
rm -rf "$NEXT"; mkdir -p "$NEXT"
tar -xzf "$SANDBOX/woven-macos.tar.gz" -C "$NEXT"
inner="$(ls "$NEXT")"
echo "9.9.9-rehearsal" >"$NEXT/$inner/VERSION"
( cd "$NEXT" && mv "$inner" "woven-9.9.9-rehearsal" && tar -czf "$SANDBOX/woven-next.tar.gz" "woven-9.9.9-rehearsal" )
WOVEN_RELEASE_KEY="$(cat "$SANDBOX/key.pem")" node "$ROOT/packaging/sign.mjs" "$SANDBOX/woven-next.tar.gz" >/dev/null

WOVEN_RELEASE_FILE="$SANDBOX/woven-next.tar.gz" bash "$INSTALLER" >"$SANDBOX/update.log" 2>&1 || {
  no "the update failed; see $SANDBOX/update.log"; tail -20 "$SANDBOX/update.log";
}
after="$(readlink "$WOVEN_HOME/current" 2>/dev/null || echo "")"
check "the update moved current" "[ '$before' != '$after' ]"
check "the previous release was kept" "[ -e '$WOVEN_HOME/previous' ] || ls '$WOVEN_HOME/releases' | wc -l | grep -qv '^ *1$'"
check "the new version is live" "grep -q 9.9.9-rehearsal '$WOVEN_HOME/current/VERSION'"

if "$WOVEN_HOME/bin/woven" rollback >"$SANDBOX/rollback.log" 2>&1; then
  ok "woven rollback ran"
  check "the old version is back" "! grep -q 9.9.9-rehearsal '$WOVEN_HOME/current/VERSION'"
else
  no "woven rollback failed; see $SANDBOX/rollback.log"
  tail -10 "$SANDBOX/rollback.log" || true
fi

# ------------------------------------------------------------- uninstall ----
say "6. Leaving cleanly"
if "$WOVEN_HOME/bin/woven" uninstall >"$SANDBOX/uninstall.log" 2>&1; then
  ok "woven uninstall ran"
  check "the data was left alone" "[ -d '$WOVEN_DATA' ]"
else
  no "woven uninstall failed; see $SANDBOX/uninstall.log"
  tail -10 "$SANDBOX/uninstall.log" || true
fi

say "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
