import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";

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
  "/mac",
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

/** Requests the dashboard makes while looking for a Core; they fail by design when none is running. */
const isCoreProbe = (url: string) => /\/v1\/(health|system|ledger|events)/.test(url) || /:4000\b/.test(url);

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (ignoredConsole.some((re) => re.test(text))) return;
    if (isCoreProbe(m.location().url)) return;
    // A failed resource says only "404" in the console; name the URL so CI failures are actionable.
    if (/Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() < 400 || /favicon/.test(url) || isCoreProbe(url)) return;
    errors.push(`${res.status()} ${url}`);
  });
  page.on("requestfailed", (req) => {
    if (isCoreProbe(req.url())) return;
    errors.push(`failed ${req.url()} ${req.failure()?.errorText ?? ""}`.trim());
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

export const LIVE = process.env.LIVE_CORE === "1";
/** The demo household seeded for LIVE_CORE runs (apps/core/src/cli/seed.ts). Recovery codes are single-use. */
export const demo = {
  email: "alex@example.com",
  household: "Alex's house",
  /** Spent by live-setup.ts to create the shared session. */
  setupCode: "demo-house",
  /** For tests that need a session of their own (they sign out, etc.); tried in order. */
  ownCodes: ["demo-key-1", "demo-key-2", "demo-key-3"],
};
/** Where live-setup.ts leaves the signed-in state (cookies on the core, session in localStorage). */
export const liveStatePath = path.resolve(__dirname, "../../test-results/live-state.json");

/** Sign in on the login page with a recovery code. */
export async function signInWithRecoveryCode(page: Page, code: string, email = demo.email) {
  await openLogin(page);
  const tab = page.getByRole("tab", { name: "I lost my devices" });
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await tab.click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Recovery code" }).fill(code);
  await page.getByRole("button", { name: "Sign in with a recovery code" }).click();
}

/** Try the test's own codes in order until one signs in (retries spend codes). */
export async function signInWithOwnCode(page: Page) {
  for (const code of demo.ownCodes) {
    await signInWithRecoveryCode(page, code);
    const outcome = await Promise.race([
      page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 }).then(() => "ok" as const),
      page.getByRole("alert").filter({ hasText: /did not match/ }).waitFor({ timeout: 15_000 }).then(() => "spent" as const),
    ]).catch(() => "unknown" as const);
    if (outcome === "ok") return;
  }
  throw new Error("every demo recovery code was spent; restart the live core");
}

/** Apply the shared signed-in state saved by live-setup.ts to this page's context. */
async function applyLiveState(page: Page) {
  const state = JSON.parse(readFileSync(liveStatePath, "utf8")) as {
    cookies: Parameters<BrowserContext["addCookies"]>[0];
    origins: { origin: string; localStorage: { name: string; value: string }[] }[];
  };
  await page.context().addCookies(state.cookies);
  const items = state.origins.flatMap((o) => o.localStorage);
  // Set localStorage once from a page on the origin (not an init script, so tests can sign out later).
  await page.goto("/login");
  await page.evaluate((entries: { name: string; value: string }[]) => {
    for (const e of entries) localStorage.setItem(e.name, e.value);
  }, items);
}

/**
 * Sign in and land on /dashboard. Without a Core this is the simulated
 * passkey flow. With LIVE_CORE the login page talks to the real core, so we
 * use the seeded owner's recovery code (a passkey needs a virtual
 * authenticator; see live-identity.spec.ts).
 */
export async function signInWithPasskey(page: Page, email = demo.email) {
  if (LIVE) {
    await applyLiveState(page);
    await page.goto("/dashboard");
  } else {
    await openLogin(page);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Continue with passkey" }).click();
  }
  await expect(page).toHaveURL(/\/dashboard(\/|$)/);
}
