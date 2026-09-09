#!/bin/bash
# Build a release tarball: the core bundle, its migrations, the static site,
# the packaging scripts, and a package.json with production dependencies only.
#   packaging/release.sh [version]  ->  release/woven-macos.tar.gz
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/apps/core/package.json').version")}"
OUT="$ROOT/release/woven-$VERSION"
rm -rf "$ROOT/release"; mkdir -p "$OUT"

echo "Building the core…"
(cd "$ROOT/apps/core" && pnpm exec tsup >/dev/null)
echo "Exporting the site…"
(cd "$ROOT/apps/web" && WOVEN_STATIC=1 NEXT_PUBLIC_WOVEN_LIVE=on NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://woventechnology.com}" pnpm exec next build >/dev/null)

cp -R "$ROOT/apps/core/dist" "$OUT/dist"
cp -R "$ROOT/apps/core/drizzle" "$OUT/drizzle"
cp -R "$ROOT/apps/web/out-build" "$OUT/web"
mkdir -p "$OUT/packaging"
cp "$ROOT/packaging/woven" "$ROOT/packaging/woven-run" "$ROOT/packaging/woven-backup" "$ROOT/packaging/com.woven.core.plist.template" "$ROOT/packaging/install.sh" "$OUT/packaging/"
cp "$ROOT/README.md" "$OUT/README.md"
echo "$VERSION" >"$OUT/VERSION"
node -e '
  const core = require(process.argv[1]);
  const deps = Object.fromEntries(Object.entries(core.dependencies).filter(([k]) => !k.startsWith("@woven/")));
  const root = require(process.argv[4]);

  // drizzle-orm/better-sqlite3 imports "better-sqlite3" by name at module load,
  // even though the Core opens the database itself with the encrypted fork and
  // only hands drizzle the finished instance. In the workspace that name
  // resolves because pnpm has the plain package in its store as a peer; a
  // release installed with npm has no such luck, and the Core dies on its first
  // import with ERR_MODULE_NOT_FOUND.
  //
  // Aliasing it to the fork fixes the import and is the right answer anyway:
  // the release then carries exactly one native SQLite module, and it is the
  // one that can open an encrypted database. Shipping both would put an
  // unencrypted engine on the volume for no reason.
  const ciphers = deps["better-sqlite3-multiple-ciphers"];
  if (!ciphers) throw new Error("the Core no longer depends on better-sqlite3-multiple-ciphers; revisit the alias below");
  deps["better-sqlite3"] = `npm:better-sqlite3-multiple-ciphers@${ciphers}`;

  const pkg = { name: "woven", version: process.argv[2], private: true, type: "module", description: "The Woven Core, packaged for a Mac.", engines: { node: ">=22.12" }, dependencies: deps, overrides: root.pnpm?.overrides ?? {} };
  require("fs").writeFileSync(process.argv[3], JSON.stringify(pkg, null, 2) + "\n");
' "$ROOT/apps/core/package.json" "$VERSION" "$OUT/package.json" "$ROOT/package.json"
(cd "$ROOT/release" && tar -czf "woven-macos.tar.gz" "woven-$VERSION")
if [ -n "${WOVEN_RELEASE_KEY:-}" ]; then
  node "$ROOT/packaging/sign.mjs" "$ROOT/release/woven-macos.tar.gz"
elif security find-generic-password -s woven-release -a key -w >/dev/null 2>&1; then
  WOVEN_RELEASE_KEY="$(security find-generic-password -s woven-release -a key -w)" node "$ROOT/packaging/sign.mjs" "$ROOT/release/woven-macos.tar.gz"
else
  echo "Not signed: no WOVEN_RELEASE_KEY and no woven-release key in the Keychain (node packaging/keygen.mjs makes one)."
fi
echo "release/woven-macos.tar.gz ($(du -h "$ROOT/release/woven-macos.tar.gz" | cut -f1))"
