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

test("the Home page runs real actions with receipts, and the Gate can be closed", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/home");
  await expect(page.getByTestId("presence")).toBeVisible({ timeout: 30_000 });

  // A class B light: one tap, done, receipt.
  const kitchen = page.getByTestId("device-kitchen.main").getByRole("switch");
  const before = await kitchen.getAttribute("aria-checked");
  await kitchen.click();
  await expect(kitchen).toHaveAttribute("aria-checked", before === "true" ? "false" : "true", { timeout: 15_000 });

  // Class D with nobody home: the Core asks first; approving from the dialog runs it.
  const lock = page.getByTestId("device-entry.front-door").getByRole("switch");
  if ((await lock.getAttribute("aria-checked")) === "true") {
    await lock.click();
    await expect(lock).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  }
  await page.getByRole("button", { name: "I'm home" }).click().catch(() => undefined);
  await expect(page.getByTestId("presence")).toContainText(/Someone is home/, { timeout: 15_000 });
  await lock.click();
  await expect(lock).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });

  await page.goto("/dashboard/activity");
  await expect(page.getByTestId("activity-live")).toBeVisible({ timeout: 30_000 });
  const ran = page.getByRole("listitem").filter({ hasText: /Action ran/ }).first();
  await expect(ran).toBeVisible({ timeout: 15_000 });
  await ran.getByRole("button").click();
  await expect(ran.getByText("Observed")).toBeVisible();

  // The Gate: close it (an action with a receipt), see the shell agree, open it again.
  await page.goto("/dashboard/network");
  await page.getByRole("button", { name: "Close the Gate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close the Gate" }).click();
  await expect(page.getByRole("heading", { name: "The Gate" }).locator("..")).toContainText("Closed · nothing crosses", { timeout: 15_000 });
  await expect(page.getByTestId("core-connection")).toBeVisible();
  await page.getByRole("button", { name: "Open the Gate" }).click();
  await expect(page.getByRole("heading", { name: "The Gate" }).locator("..")).toContainText("Open · asks first", { timeout: 15_000 });
});
