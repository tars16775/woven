// Visual QA helper: screenshots a page (and optionally each section anchor)
// using the locally installed Chrome. Usage:
//   node scripts/shoot.mjs <outDir> <url> [ids,comma,separated] [width] [height]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir = "shots", url = "http://localhost:3000/", idsArg = "", w = "1440", h = "900"] =
  process.argv.slice(2);
const ids = idsArg ? idsArg.split(",").filter(Boolean) : [];
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: [
    "--hide-scrollbars",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
  ],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.error(`[console.${m.type()}]`, m.text().slice(0, 300));
});
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
if (process.env.SESSION) {
  // Pre-seed a dashboard session so guarded pages render.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem(
      "woven:session",
      JSON.stringify({ household: "Alex's house", name: "Alex", email: "alex@example.com", method: "passkey", at: Date.now() }),
    );
  });
}
await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, Number(process.env.SETTLE_MS ?? 600)));

const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page";
await page.screenshot({ path: join(outDir, `${slug(new URL(url).pathname)}-top.png`) });

for (const spec of ids) {
  const [id, extra = "0"] = spec.split("+");
  const ok = await page.evaluate(
    ([id, extra]) => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ behavior: "instant", block: "start" });
      if (extra) window.scrollBy(0, Number(extra));
      return true;
    },
    [id, extra],
  );
  if (!ok) {
    console.warn(`no element #${id}`);
    continue;
  }
  await page.evaluate(
    () =>
      new Promise((r) => {
        window.dispatchEvent(new Event("scroll"));
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 900)));
      }),
  );
  await page.screenshot({ path: join(outDir, `${id}${extra !== "0" ? "-" + extra : ""}.png`) });
}

if (ids.length === 0) {
  // No anchors: walk the page one viewport at a time.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Number(h);
  let i = 0;
  for (let y = step; y < total; y += step) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: join(outDir, `scroll-${++i}.png`) });
  }
}

await browser.close();
console.log(`wrote screenshots to ${outDir}`);
