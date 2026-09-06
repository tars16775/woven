import { expect, test } from "@playwright/test";
import { collectConsoleErrors, signInWithPasskey } from "./helpers";

/**
 * The dashboard against a real Woven Core (LIVE_CORE=1 starts one on :4000).
 * These are the screens phase 6 switched from preview data to the typed API.
 */
test.skip(process.env.LIVE_CORE !== "1", "needs LIVE_CORE=1 (a real core on :4000)");

test("the shell finds the core and shows its real numbers", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await signInWithPasskey(page);
  const chip = page.getByTestId("core-connection");
  await expect(chip).toContainText(/Core · localhost/, { timeout: 30_000 });
  await expect(page.getByTestId("core-memory")).toContainText(/\d+(\.\d+)? \/ \d+ GB/);
  await expect(page.getByTestId("core-storage")).toContainText(/\d+ (GB|TB)/);
  expect(errors).toEqual([]);
});

test("the Core page reports the machine, verifies the ledger, and Activity shows real rows", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/core");
  await expect(page.getByTestId("core-connection")).toContainText(/Core · localhost/, { timeout: 30_000 });
  await expect(page.getByTestId("core-version")).toContainText(/Woven Core 0\.\d+\.\d+/);
  await expect(page.getByTestId("core-model")).not.toBeEmpty();
  await expect(page.getByTestId("core-uptime")).toContainText(/up (just now|\d+ (min|h|days))/);

  await page.getByRole("button", { name: "Verify the ledger" }).click();
  await expect(page.getByTestId("ledger-integrity")).toContainText(/Chain intact · \d+ rows/);

  await page.goto("/dashboard/activity");
  await expect(page.getByTestId("activity-live")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /Ledger verified|Core started/ }).first()).toBeVisible();
});
