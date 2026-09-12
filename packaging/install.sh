#!/bin/bash
# Install Woven on this Mac as a service that starts at login.
#   curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash
# Everything lands under ~/.woven (the program, Node, logs) and your data under
# ~/Library/Application Support/Woven unless you set WOVEN_DATA. Re-running
# updates the program and keeps your data and configuration.
set -euo pipefail

# --client: only the woven-backup command, for a Mac that backs up to a Core elsewhere in the house.
CLIENT_ONLY=""
for arg in "$@"; do case "$arg" in --client) CLIENT_ONLY=1 ;; esac; done

REPO="${WOVEN_REPO:-tars16775/woven}"
NODE_VERSION="${WOVEN_NODE_VERSION:-22.22.0}"
WOVEN_HOME="${WOVEN_HOME:-$HOME/.woven}"
LABEL="${WOVEN_LABEL:-com.woven.core}"
say() { printf '\033[1m%s\033[0m\n' "$*"; }

[ "$(uname -s)" = "Darwin" ] || { echo "This installer is for macOS. The box image comes later."; exit 1; }
case "$(uname -m)" in arm64) NODE_ARCH=darwin-arm64 ;; x86_64) NODE_ARCH=darwin-x64 ;; *) echo "Unknown architecture $(uname -m)"; exit 1 ;; esac
command -v curl >/dev/null || { echo "curl is needed."; exit 1; }

mkdir -p "$WOVEN_HOME/bin" "$WOVEN_HOME/logs" "$WOVEN_HOME/releases" "$WOVEN_HOME/tmp"

# 1. Node, private to Woven, checked against the published hashes.
if [ ! -x "$WOVEN_HOME/node/bin/node" ] || [ "$("$WOVEN_HOME/node/bin/node" -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
  say "Fetching Node $NODE_VERSION for $NODE_ARCH..."
  tarball="node-v$NODE_VERSION-$NODE_ARCH.tar.gz"
  curl -fsSL -o "$WOVEN_HOME/tmp/$tarball" "https://nodejs.org/dist/v$NODE_VERSION/$tarball"
  curl -fsSL -o "$WOVEN_HOME/tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  expected=$(grep " $tarball\$" "$WOVEN_HOME/tmp/SHASUMS256.txt" | awk '{print $1}')
  actual=$(shasum -a 256 "$WOVEN_HOME/tmp/$tarball" | awk '{print $1}')
  [ "$expected" = "$actual" ] || { echo "Node download did not match its published hash; stopping."; exit 1; }
  rm -rf "$WOVEN_HOME/node"
  mkdir -p "$WOVEN_HOME/node"
  tar -xzf "$WOVEN_HOME/tmp/$tarball" -C "$WOVEN_HOME/node" --strip-components=1
fi
export PATH="$WOVEN_HOME/node/bin:$PATH"

# 2. The program: the newest release, or a file you point at with WOVEN_RELEASE_FILE.
if [ -n "${WOVEN_RELEASE_FILE:-}" ]; then
  release="$WOVEN_RELEASE_FILE"
else
  say "Fetching the newest Woven release..."
  release="$WOVEN_HOME/tmp/woven-macos.tar.gz"
  url="${WOVEN_RELEASE_URL:-https://github.com/$REPO/releases/latest/download/woven-macos.tar.gz}"
  if ! curl -fsSL -o "$release" "$url"; then
    # A private repository: GitHub's command-line tool can fetch the release with your login.
    if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
      gh release download --repo "$REPO" --pattern woven-macos.tar.gz --output "$release" --clobber
    else
      echo "Could not fetch $url. If the repository is private, sign in with 'gh auth login' and run this again, or set WOVEN_RELEASE_FILE to a downloaded tarball."
      exit 1
    fi
  fi
fi
# 2b. The signature (gap 22). Every release is signed with the Woven release key; the public half is here,
#     so a hosted copy of this script carries the trust root. WOVEN_UNSIGNED=1 skips the check for a local build.
sig="$release.sig"
if [ -z "${WOVEN_RELEASE_FILE:-}" ] && [ ! -f "$sig" ]; then
  curl -fsSL -o "$sig" "${WOVEN_RELEASE_URL:-https://github.com/$REPO/releases/latest/download/woven-macos.tar.gz}.sig" 2>/dev/null \
    || { command -v gh >/dev/null && gh release download --repo "$REPO" --pattern woven-macos.tar.gz.sig --output "$sig" --clobber >/dev/null 2>&1; } || true
fi
if [ -z "${WOVEN_UNSIGNED:-}" ]; then
  pub="$WOVEN_HOME/tmp/woven-release.pub"
  cat >"$pub" <<'PUB'
__WOVEN_RELEASE_PUB__
PUB
  if grep -q "BEGIN PUBLIC KEY" "$pub"; then
    [ -f "$sig" ] || { echo "No signature was published for this release; stopping. (WOVEN_UNSIGNED=1 installs an unsigned local build.)"; exit 1; }
    node -e '
      const { createPublicKey, verify } = require("node:crypto");
      const { readFileSync } = require("node:fs");
      const [file, sigFile, pubFile] = process.argv.slice(1);
      const ok = verify(null, readFileSync(file), createPublicKey(readFileSync(pubFile, "utf8")), Buffer.from(readFileSync(sigFile, "utf8").trim(), "base64"));
      if (!ok) { console.error("The release does not match the Woven release key; stopping."); process.exit(1); }
      console.log("Release signature verified.");
    ' "$release" "$sig" "$pub" || exit 1
  else
    echo "No release public key is embedded in this installer yet; installing without verification."
  fi
fi

stage="$WOVEN_HOME/tmp/stage"
rm -rf "$stage"; mkdir -p "$stage"
tar -xzf "$release" -C "$stage" --strip-components=1
version=$(cat "$stage/VERSION")
dest="$WOVEN_HOME/releases/$version"
if [ -d "$dest" ] && [ -f "$dest/.complete" ]; then
  say "Woven $version is already here."
else
  rm -rf "$dest"; mv "$stage" "$dest"
  say "Installing dependencies for Woven $version (native pieces build for this Mac)..."
  (cd "$dest" && npm install --omit=dev --no-audit --no-fund --loglevel=error >"$WOVEN_HOME/logs/install.log" 2>&1) || { echo "npm install failed; see $WOVEN_HOME/logs/install.log"; exit 1; }
  touch "$dest/.complete"
fi
# Keep the release that was running so `woven rollback` can go back to it.
if [ -L "$WOVEN_HOME/current" ] && [ "$(readlink "$WOVEN_HOME/current")" != "$dest" ]; then ln -sfn "$(readlink "$WOVEN_HOME/current")" "$WOVEN_HOME/previous"; fi
ln -sfn "$dest" "$WOVEN_HOME/current"
install -m 0755 "$dest/packaging/woven" "$WOVEN_HOME/bin/woven"
install -m 0755 "$dest/packaging/woven-run" "$WOVEN_HOME/bin/woven-run"
install -m 0755 "$dest/packaging/woven-backup" "$WOVEN_HOME/bin/woven-backup"

if [ -n "$CLIENT_ONLY" ]; then
  case ":$PATH:" in *":$WOVEN_HOME/bin:"*) ;; *)
    for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
      [ -f "$rc" ] && ! grep -q '.woven/bin' "$rc" && printf '\n# Woven\nexport PATH="$HOME/.woven/bin:$PATH"\n' >>"$rc"
    done ;;
  esac
  say "The Woven backup client $version is installed."
  echo "  Next: make a token under Settings, Backup devices on your household's dashboard, then"
  echo "        woven-backup connect https://woven.local:4000 <token>"
  echo "        woven-backup run ~/Documents --watch      (open a new terminal for PATH)"
  exit 0
fi

# 3. Configuration, written once and kept.
if [ ! -f "$WOVEN_HOME/config.env" ]; then
  cat >"$WOVEN_HOME/config.env" <<CONF
# Woven configuration. Edit, then: woven restart
NODE_ENV=production
WOVEN_DATA="${WOVEN_DATA:-$HOME/Library/Application Support/Woven}"
WOVEN_NAME="${WOVEN_NAME:-woven.local}"
WOVEN_PORT="${WOVEN_PORT:-4000}"
WOVEN_TRUST_PORT="${WOVEN_TRUST_PORT:-4001}"
WOVEN_LOCAL_PORT="${WOVEN_LOCAL_PORT:-4002}"
WOVEN_GATE_PORT="${WOVEN_GATE_PORT:-4010}"
WOVEN_ORIGINS="https://${WOVEN_NAME:-woven.local}:${WOVEN_PORT:-4000},http://localhost:${WOVEN_LOCAL_PORT:-4002},https://localhost:${WOVEN_PORT:-4000}"
WOVEN_SNAPSHOT_MIRROR=""
# Remote access. Empty keeps this Core reachable at home only, which is the
# default because an outbound tunnel is a decision, not a convenience.
# To reach your house from away, put the relay address on the line below and
# run: woven restart. Woven's relay is
#   wss://relay.woventechnology.com
# It carries sealed frames it cannot read and keeps nothing; any relay that
# speaks the same protocol works, including one you run yourself.
WOVEN_RELAY=""
# Opt-in nightly health ping to woventechnology.com (version and uptime only, through the Gate, with a receipt).
WOVEN_HEALTH_PING="off"
LOG_LEVEL="info"
CONF
fi
set -a; . "$WOVEN_HOME/config.env"; set +a
mkdir -p "$WOVEN_DATA"

# 4. The service. (With WOVEN_NO_LAUNCHD the plist is written inside WOVEN_HOME and nothing outside it is touched.)
if [ -n "${WOVEN_NO_LAUNCHD:-}" ]; then plist="$WOVEN_HOME/$LABEL.plist"; else mkdir -p "$HOME/Library/LaunchAgents"; plist="$HOME/Library/LaunchAgents/$LABEL.plist"; fi
sed -e "s#__LABEL__#$LABEL#g" -e "s#__HOME__#$WOVEN_HOME#g" -e "s#__USERHOME__#$HOME#g" "$dest/packaging/com.woven.core.plist.template" >"$plist"
if [ -z "${WOVEN_NO_LAUNCHD:-}" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  for i in $(seq 1 60); do curl -sk -o /dev/null "https://localhost:$WOVEN_PORT/v1/health" && break; sleep 1; done
fi

# 5. Your shell.
if [ -z "${WOVEN_NO_LAUNCHD:-}" ]; then case ":$PATH:" in *":$WOVEN_HOME/bin:"*) ;; *)
  for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
    [ -f "$rc" ] && ! grep -q '.woven/bin' "$rc" && printf '\n# Woven\nexport PATH="$HOME/.woven/bin:$PATH"\n' >>"$rc"
  done ;;
esac; fi

say "Woven $version is installed."
echo "  Dashboard:   https://$WOVEN_NAME:$WOVEN_PORT   (on this Mac also http://localhost:$WOVEN_LOCAL_PORT)"
echo "  Other devices: open http://$WOVEN_NAME:$WOVEN_TRUST_PORT once to trust the household certificate."
echo "  Data:        $WOVEN_DATA"
echo "  Command:     woven status | woven logs | woven stop | woven update   (open a new terminal for PATH)"
if [ -z "${WOVEN_NO_LAUNCHD:-}" ] && [ -z "${WOVEN_NO_OPEN:-}" ]; then open "http://localhost:$WOVEN_LOCAL_PORT/signup" >/dev/null 2>&1 || true; fi
