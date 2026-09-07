import { expect, test } from "@playwright/test";
import { signInWithPasskey } from "./helpers";

/**
 * The kill switch, in a project of its own that runs after every other live
 * test: while the Core is off nothing else answers, so this cannot share a
 * Core with tests in flight.
 */
test("the kill switch: off refuses everything but itself, on brings it back", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/core");
  await expect(page.getByTestId("power-state")).toHaveText("On", { timeout: 30_000 });
  await page.getByTestId("power-off").click();
  await page.getByTestId("power-off-confirm").click();
  await expect(page.getByTestId("power-state")).toHaveText("Off", { timeout: 20_000 });
  await expect(page.getByTestId("power-banner")).toBeVisible();
  // The API answers 503 for household data while off; the dashboard still loads.
  const refused = await page.evaluate(async () => {
    const r = await fetch("http://localhost:4000/v1/files/summary", { credentials: "include", headers: { "x-woven-device": localStorage.getItem("woven:device") ?? "" } });
    return r.status;
  });
  expect(refused).toBe(503);
  await page.goto("/dashboard");
  await expect(page.getByTestId("overview-sub")).toContainText("switched off", { timeout: 20_000 });
  await page.getByTestId("power-on").click();
  await expect(page.getByTestId("power-state")).toHaveText("On", { timeout: 20_000 });
  await expect(page.getByTestId("power-banner")).toHaveCount(0);
  await expect(page.getByTestId("overview-stats")).toBeVisible({ timeout: 20_000 });
});
