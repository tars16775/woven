// Gap 12, and then some: the dashboard has no sample household at all. There
// used to be a `@/lib/dashboard/data` module holding an invented house, and
// screens fell back to it whenever no Core was answering. It is gone, and
// this keeps it gone: nothing under src/ may import it, and no screen may
// reintroduce one under another name.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const offenders = [];

// Modules that would be a mock household by another name.
const banned = [/@\/lib\/dashboard\/data/, /@\/lib\/dashboard\/mock/, /@\/lib\/dashboard\/sample/, /@\/lib\/dashboard\/preview/];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith("._")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) check(p);
  }
}

function check(file) {
  const src = readFileSync(file, "utf8");
  for (const re of banned) {
    if (re.test(src)) offenders.push(`${relative(root, file)}: imports ${re.source.replace(/\\/g, "")}`);
  }
}

walk(root);
if (offenders.length) {
  console.error("The dashboard shows a real Core or an honest empty state. These files reach for a sample household:\n  " + offenders.join("\n  "));
  process.exit(1);
}
console.log("check-live: no sample household anywhere in the dashboard");
