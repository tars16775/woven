import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { LIVE, settle, signInWithPasskey } from "./helpers";

/**
 * Accessibility (gap 28): axe runs against the public pages, the login page
 * and, with a Core, the dashboard. Anything serious or critical fails the build;
 * moderate findings are listed so they do not hide.
 */
// Playwright loads specs as CommonJS; the package is resolved from the app folder it runs in.
const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };

async function audit(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    return axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
  });
  return result.violations;
}

/**
 * Sections fade in as they scroll into view, and axe measures contrast on
 * whatever opacity it finds. Auditing mid-fade reports a failure nobody
 * experiences, so bring every section into view first and wait for the
 * transitions to end. Looping animations are not transitions and are left
 * alone; they never finish, and that is not what is being waited for.
 */
async function revealed(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page
    .waitForFunction(() => !document.querySelector('[data-reveal="hidden"]') && document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"), null, { timeout: 5_000 })
    .catch(() => {});
}

const pages = ["/", "/core", "/order", "/privacy", "/support", "/mac", "/status", "/login", "/founding-homes"];

for (const path of pages) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(page);
    await revealed(page);
    const violations = await audit(page);
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const moderate = violations.filter((v) => v.impact === "moderate");
    if (moderate.length) console.log(`${path}: moderate findings: ${moderate.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`);
    expect(serious.map((v) => `${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join("; ")}`)).toEqual([]);
  });
}

test("the dashboard has no serious accessibility violations", async ({ page }) => {
  test.skip(!LIVE, "the dashboard needs a Core to render; run with LIVE_CORE=1");
  await signInWithPasskey(page);
  for (const path of ["/dashboard", "/dashboard/files", "/dashboard/settings", "/dashboard/privacy"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(page);
    const serious = (await audit(page)).filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path} ${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join("; ")}`)).toEqual([]);
  }
});

test("honours a request for reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await settle(page);
  const orb = page.locator(".orb").first();
  if (await orb.count()) {
    // Not a one-shot evaluate: hydration can replace the node between finding
    // it and asking, and a detached element answers "" for every property.
    await expect(orb).toHaveCSS("animation-name", "none");
  }
  await context.close();
});
