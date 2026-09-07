import { expect, test } from "@playwright/test";
import { collectConsoleErrors, publicPaths, settle } from "./helpers";

test.describe("public routes", () => {
  for (const path of publicPaths) {
    test(`${path} renders`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response, "navigation produced a response").not.toBeNull();
      expect(response!.status()).toBe(200);
      await settle(page);

      await expect(page).toHaveTitle(/Woven/);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("main")).toBeAttached();

      // Give hydration and the 3D scenes a moment to surface any runtime error.
      await page.waitForTimeout(500);
      expect(errors, `console errors on ${path}`).toEqual([]);
    });
  }
});

test("/dashboard sends a signed-out visitor to /login", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const response = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  expect(response!.status()).toBe(200);
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page).toHaveTitle(/Woven/);
  await expect(page.getByRole("heading", { level: 1, name: "Reach your house." })).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe("platform files", () => {
  test("robots.txt allows the site and hides the private routes", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/Allow: \//);
    for (const p of ["/dashboard", "/login", "/signup", "/order/status"]) expect(body).toContain(`Disallow: ${p}`);
    expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("sitemap.xml lists every public route", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/xml/);
    const body = await res.text();
    for (const p of publicPaths) {
      const suffix = p === "/" ? "" : p;
      expect(body).toMatch(new RegExp(`<loc>https?://[^<]+${suffix.replace(/[-/]/g, "\\$&")}</loc>`));
    }
    expect(body).not.toContain("/dashboard");
    expect(body).not.toContain("/login");
  });

  test("manifest and icons are served", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect(manifest.headers()["content-type"]).toMatch(/manifest\+json/);
    const json = await manifest.json();
    expect(json).toMatchObject({ name: "Woven", short_name: "Woven", start_url: "/dashboard", display: "standalone" });

    for (const path of ["/icon", "/apple-icon"]) {
      const icon = await request.get(path);
      expect(icon.status(), path).toBe(200);
      expect(icon.headers()["content-type"], path).toBe("image/png");
    }
    const ico = await request.get("/favicon.ico");
    expect(ico.status()).toBe(200);
    expect(ico.headers()["content-type"]).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
  });
});

test("the product bar appears once the hero is past, and jumps to a section", async ({ page }) => {
  await page.goto("/core-plus", { waitUntil: "domcontentloaded" });
  // The bar is a client component; wait for it to exist before judging whether it shows.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-product-nav]")).toBeAttached();
  const bar = page.getByRole("navigation", { name: "Woven Core+ sections" });
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.6));
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await expect(bar).toContainText("Woven Core+");
  await bar.getByRole("link", { name: "Specs" }).click();
  await expect(page.locator("#specs")).toBeInViewport();
});

test("the landing page shows its copy without waiting for an animation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  // The hero is never hidden by the reveal; the failsafe is for the rest.
  const opacity = await h1.evaluate((el) => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity);
  expect(Number(opacity)).toBe(1);
  await expect(page.getByText("The box is not built yet", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Run it on your Mac" })).toBeVisible();
});
