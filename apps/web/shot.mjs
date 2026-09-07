import { chromium } from "@playwright/test";
const [, , outDir, ...paths] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Sign in once with a recovery code, then screenshot each room.
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
// The dev server compiles on first request; the tabs only work once hydrated.
const tab = page.getByRole("tab", { name: "I lost my devices" });
await tab.waitFor({ timeout: 120000 });
for (let i = 0; i < 40; i += 1) {
  await tab.click().catch(() => {});
  if ((await tab.getAttribute("aria-selected")) === "true") break;
  await page.waitForTimeout(500);
}
await page.getByRole("textbox", { name: "Email" }).fill("alex@example.com");
await page.getByRole("textbox", { name: "Recovery code" }).fill(process.env.CODE || "design-1");
await page.getByRole("button", { name: "Sign in with a recovery code" }).click();
try {
  await page.waitForURL(/\/dashboard/, { timeout: 60000, waitUntil: "domcontentloaded" });
} catch {
  console.log("URL:", page.url());
  console.log("alerts:", await page.locator('[role="alert"]').allInnerTexts());
  console.log("notice:", await page.locator('[role="note"]').allInnerTexts());
  console.log("nocore:", await page.getByTestId("login-no-core").count());
  await page.screenshot({ path: `${outDir}/_login-fail.png`, fullPage: true });
  throw new Error("sign-in did not reach the dashboard");
}
await page.waitForSelector('nav[aria-label="Dashboard"]', { timeout: 90000 });

for (const p of paths) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const name = p.replace(/\//g, "_") || "_root";
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log("shot", p);
}
await browser.close();
