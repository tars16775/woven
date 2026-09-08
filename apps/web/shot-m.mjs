import { chromium, devices } from "@playwright/test";
const [, , outDir, ...paths] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
const tab = page.getByRole("tab", { name: "I lost my devices" });
await tab.waitFor({ timeout: 120000 });
for (let i = 0; i < 40; i++) { await tab.click().catch(()=>{}); if ((await tab.getAttribute("aria-selected")) === "true") break; await page.waitForTimeout(400); }
await page.getByRole("textbox", { name: "Email" }).fill("alex@example.com");
await page.getByRole("textbox", { name: "Recovery code" }).fill(process.env.CODE);
await page.getByRole("button", { name: "Sign in with a recovery code" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 90000, waitUntil: "domcontentloaded" });
await page.waitForSelector('main#main', { timeout: 90000 });
for (const p of paths) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${outDir}/m${p.replace(/\//g, "_")}.png`, fullPage: true });
  console.log("shot", p);
}
await browser.close();
