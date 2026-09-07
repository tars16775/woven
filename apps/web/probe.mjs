import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
const tab = page.getByRole("tab", { name: "I lost my devices" });
await tab.waitFor({ timeout: 120000 });
for (let i = 0; i < 40; i++) { await tab.click().catch(()=>{}); if ((await tab.getAttribute("aria-selected")) === "true") break; await page.waitForTimeout(400); }
await page.getByRole("textbox", { name: "Email" }).fill("alex@example.com");
await page.getByRole("textbox", { name: "Recovery code" }).fill(process.env.CODE);
await page.getByRole("button", { name: "Sign in with a recovery code" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 60000, waitUntil: "domcontentloaded" });
await page.waitForSelector('nav[aria-label="Dashboard"]', { timeout: 60000 });
await page.waitForTimeout(3000);
// What is painted over the sidebar foot?
const info = await page.evaluate(() => {
  const out = [];
  for (const [x, y] of [[33, 880], [33, 895], [60, 880]]) {
    const stack = document.elementsFromPoint(x, y).slice(0, 4).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === "string" ? el.className : "").slice(0, 70)} | pos=${cs.position} z=${cs.zIndex} rect=${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} | "${(el.textContent||"").trim().slice(0,40)}"`;
    });
    out.push({ at: [x, y], stack });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
