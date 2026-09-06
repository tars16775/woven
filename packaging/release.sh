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
  const pkg = { name: "woven", version: process.argv[2], private: true, type: "module", description: "The Woven Core, packaged for a Mac.", engines: { node: ">=22.12" }, dependencies: deps, overrides: root.pnpm?.overrides ?? {} };
  require("fs").writeFileSync(process.argv[3], JSON.stringify(pkg, null, 2) + "\n");
' "$ROOT/apps/core/package.json" "$VERSION" "$OUT/package.json" "$ROOT/package.json"
(cd "$ROOT/release" && tar -czf "woven-macos.tar.gz" "woven-$VERSION")
echo "release/woven-macos.tar.gz ($(du -h "$ROOT/release/woven-macos.tar.gz" | cut -f1))"
