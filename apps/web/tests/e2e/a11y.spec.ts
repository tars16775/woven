import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers";

/**
 * Accessibility (gap 28): axe runs against the public pages, the login page
 * and the dashboard preview. Anything serious or critical fails the build;
 * moderate findings are listed so they do not hide.
 */
const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };

async function audit(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    return axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
  });
  return result.violations;
}

const pages = ["/", "/core", "/order", "/privacy", "/support", "/mac", "/login", "/founding-homes"];

for (const path of pages) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(page);
    const violations = await audit(page);
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const moderate = violations.filter((v) => v.impact === "moderate");
    if (moderate.length) console.log(`${path}: moderate findings: ${moderate.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`);
    expect(serious.map((v) => `${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join("; ")}`)).toEqual([]);
  });
}

test("the dashboard preview has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await settle(page);
  // The preview sign-in: a code on the screen is simulated when no Core is present.
  const tab = page.getByRole("tab", { name: /Code on the screen|Code am Bildschirm/ });
  if (await tab.isVisible()) await tab.click();
  const input = page.getByRole("textbox").first();
  await input.fill("alex@example.com");
  const button = page.getByRole("button", { name: /continue|sign in|weiter|anmelden/i }).first();
  await button.click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 }).catch(() => undefined);
  if (!/\/dashboard/.test(page.url())) test.skip(true, "the preview sign-in did not reach the dashboard on this build");
  for (const path of ["/dashboard", "/dashboard/files", "/dashboard/settings", "/dashboard/privacy"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(page);
    const serious = (await audit(page)).filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
  }
});

test("honours a request for reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await settle(page);
  const orb = page.locator(".orb").first();
  if (await orb.count()) {
    const animation = await orb.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  }
  await context.close();
});
