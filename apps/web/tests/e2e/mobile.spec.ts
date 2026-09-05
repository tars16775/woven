import { expect, test } from "@playwright/test";
import { settle } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("the home page has no horizontal scrollbar through its first three sections", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await expect(page.locator("h1").first()).toBeVisible();

  for (const id of ["hero", "sides", "tandem"]) {
    const section = page.locator(`section#${id}`);
    await expect(section).toBeAttached();
    await section.evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.waitForTimeout(400);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(metrics.scrollWidth, `#${id}: document overflows horizontally`).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.bodyScrollWidth, `#${id}: body overflows horizontally`).toBeLessThanOrEqual(metrics.innerWidth);
  }
});

test("the mobile menu opens and lists the primary routes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  for (const label of ["Core", "Tandem", "Home", "Privacy", "Shop", "Support", "Sign in"]) {
    await expect(menu.getByRole("link", { name: label })).toBeVisible();
  }
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(menu).toBeHidden();
});
