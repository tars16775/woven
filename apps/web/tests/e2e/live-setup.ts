import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { demo, liveStatePath, signInWithRecoveryCode } from "./helpers";

/**
 * Runs once before the live suite: sign the seeded owner in with a
 * single-use recovery code and save the resulting state (the session cookie
 * on the core, the session record in localStorage) for the other tests.
 */
setup("sign the demo owner in once", async ({ page }) => {
  await signInWithRecoveryCode(page, demo.setupCode);
  await expect(page).toHaveURL(/\/dashboard(\/|$)/, { timeout: 30_000 });
  await expect(page.getByTestId("core-connection")).toContainText(/Core · localhost/, { timeout: 30_000 });
  mkdirSync(path.dirname(liveStatePath), { recursive: true });
  await page.context().storageState({ path: liveStatePath });
});
