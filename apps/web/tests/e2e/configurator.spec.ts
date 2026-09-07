import { expect, test, type Locator, type Page } from "@playwright/test";
import { collectConsoleErrors, untilHydrated } from "./helpers";

const total = (page: Page) =>
  page.locator("dt", { hasText: /^Target total$/ }).locator("xpath=following-sibling::dd[1]");

/** Click an option; before hydration the click is lost, so retry until it is reflected. */
async function choose(option: Locator) {
  await untilHydrated(async () => {
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
  });
}

test("picking Core Pro changes the estimated total", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/order");

  await expect(page.getByRole("heading", { level: 2, name: /^Woven Core/ }).first()).toHaveText("Woven Core+");
  await expect(total(page)).toHaveText("$1,499");

  await choose(page.getByRole("radio", { name: /^Core Pro/ }));

  await expect(page.getByRole("heading", { level: 2, name: /^Woven Core/ }).first()).toHaveText("Woven Core Pro");
  await expect(total(page)).toHaveText("$2,499");
  await expect(page).toHaveURL(/tier=core-pro/);
  expect(errors).toEqual([]);
});

test("storage and add-ons add to the total", async ({ page }) => {
  await page.goto("/order?tier=core");
  await expect(total(page)).toHaveText("$899");

  await choose(page.getByRole("radio", { name: /^2 TB/ }));
  await expect(total(page)).toHaveText("$1,019");

  await choose(page.getByRole("checkbox", { name: /Z-Wave radio/ }));
  await expect(total(page)).toHaveText("$1,088");
});
