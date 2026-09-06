import { expect, test } from "@playwright/test";
import { LIVE, collectConsoleErrors, openLogin, signInWithPasskey } from "./helpers";

test("signing in with a passkey reaches the dashboard", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await signInWithPasskey(page, "alex@example.com");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening), Alex/);
  await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeVisible();

  const session = await page.evaluate(() => localStorage.getItem("woven:session"));
  expect(session).not.toBeNull();
  expect(JSON.parse(session!)).toMatchObject({ email: "alex@example.com", method: LIVE ? "recovery" : "passkey" });
  expect(errors).toEqual([]);
});

test("an email without an @ is refused", async ({ page }) => {
  await openLogin(page);
  await page.getByLabel("Email").fill("alex");
  await page.getByRole("button", { name: "Continue with passkey" }).click();
  // Next's route announcer is also role=alert, so pick the form's own message.
  const error = page.getByRole("alert").filter({ hasText: "Enter the email" });
  await expect(error).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/login/);
});

test("signing out returns to the login page", async ({ page }) => {
  await signInWithPasskey(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(() => localStorage.removeItem("woven:session"));
  await page.goto("/dashboard/files");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Ffiles/);
});
