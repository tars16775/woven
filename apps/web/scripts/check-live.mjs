// Gap 12: live screens must not import preview data. A file whose name
// starts with "live" (or sits in a live-only component) is what a household
// sees when connected to its own Core; a mock number there would be a lie.
// Type-only imports are fine: the shapes are the contract.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith("._")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/^live[^/]*\.tsx?$/.test(name) || /^(pilot-card|memory-card|passkeys-card|backups-card|data-rights-card|approvals)\.tsx$/.test(name)) check(p);
  }
}

function check(file) {
  // The one deliberate boundary: lib/core/live.ts hands screens the preview only while nothing is connected.
  if (file.endsWith("/lib/core/live.ts")) return;
  const src = readFileSync(file, "utf8");
  const re = /^import\s+(type\s+)?(\{[^}]*\}|[^;]+?)\s+from\s+"@\/lib\/dashboard\/data";/gm;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) continue; // import type { ... }
    const names = m[2].replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    const values = names.filter((n) => !n.startsWith("type "));
    if (values.length) offenders.push(`${relative(root, file)}: imports ${values.join(", ")} from the preview data`);
  }
}

walk(root);
if (offenders.length) {
  console.error("Live screens import preview data:\n  " + offenders.join("\n  "));
  process.exit(1);
}
console.log("check-live: no preview data on live screens");
