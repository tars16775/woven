import { expect, type ConsoleMessage, type Page } from "@playwright/test";

/** The public routes from src/app/sitemap.ts, kept as plain paths for the browser. */
export const publicPaths = [
  "/",
  "/core",
  "/core-plus",
  "/core-pro",
  "/order",
  "/tandem",
  "/home",
  "/privacy",
  "/founding-homes",
  "/support",
  "/developers",
  "/legal",
  "/press",
  "/careers",
  "/contact",
];

/**
 * Browser noise that is not a page bug: a 404 for a favicon in a route
 * group, WebGL falling back to software, and the dev overlay's HMR chatter.
 */
const ignoredConsole = [
  /Download the React DevTools/i,
  /WebGL.*(software|swiftshader|fallback|performance)/i,
  /GPU stall due to ReadPixels/i,
  /\[Fast Refresh\]/i,
  /Failed to load resource: the server responded with a status of 404.*favicon/i,
];

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (ignoredConsole.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Wait for fonts and the first paint of the client bundle so screenshots and scroll metrics are stable. */
export async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
}

/**
 * The dev server compiles on first request, so a page can be painted long
 * before React has attached its handlers. Interacting before then is lost.
 * `probe` should perform an interaction that only works once hydrated and
 * assert its effect; it is retried until it sticks.
 */
export async function untilHydrated(probe: () => Promise<void>, timeout = 60_000) {
  await expect(probe).toPass({ timeout, intervals: [250, 500, 1000] });
}

/** Open /login and wait until the form is interactive, using the method tabs as the hydration probe. */
export async function openLogin(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Reach your house." })).toBeVisible();
  const codeTab = page.getByRole("tab", { name: "Code on the screen" });
  const passkeyTab = page.getByRole("tab", { name: "Passkey" });
  await untilHydrated(async () => {
    await codeTab.click();
    await expect(codeTab).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  });
  await passkeyTab.click();
  await expect(passkeyTab).toHaveAttribute("aria-selected", "true");
}

/** Sign in through the simulated passkey flow and land on `next` (default /dashboard). */
export async function signInWithPasskey(page: Page, email = "alex@example.com") {
  await openLogin(page);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue with passkey" }).click();
  await expect(page).toHaveURL(/\/dashboard(\/|$)/);
}
