// The runtime image is dist and nothing else. Fail the build if the bundle
// still imports a package by name, because that package will not be there.
// Node's own modules are fine with or without the node: prefix; bundled
// dependencies import some of them bare.
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

const builtin = new Set(builtinModules);
const src = readFileSync(new URL("../dist/server.js", import.meta.url), "utf8");
const bare = [...src.matchAll(/^\s*import\s[^'"]*?from\s*["']([^"'.\/][^"']*)["']/gm), ...src.matchAll(/\bimport\(\s*["']([^"'.\/][^"']*)["']\s*\)/g)]
  .map((m) => m[1])
  .filter((s) => !s.startsWith("node:") && !builtin.has(s.split("/")[0]));
if (bare.length) {
  console.error(`dist/server.js imports packages that will not exist in the runtime image: ${[...new Set(bare)].join(", ")}`);
  process.exit(1);
}
console.log("dist/server.js is self-contained");
