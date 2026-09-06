import { expect, test, type Page } from "@playwright/test";
import { demo, signInWithOwnCode } from "./helpers";

/**
 * Passkeys against a real Core (LIVE_CORE=1), with Chrome's virtual
 * authenticator standing in for Touch ID. The seeded owner signs in with a
 * recovery code, adds a passkey on this device, signs out, and comes back
 * in with the passkey alone.
 */
test.skip(process.env.LIVE_CORE !== "1", "needs LIVE_CORE=1 (a real core on :4000)");

async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

test("recovery code, then a passkey on this device, then passkey sign-in", async ({ page }) => {
  const { cdp, authenticatorId } = await virtualAuthenticator(page);

  await signInWithOwnCode(page);
  await page.goto("/dashboard/settings");
  await expect(page.getByTestId("core-connection")).toContainText(/Core · localhost/, { timeout: 30_000 });
  await expect(page.getByTestId("no-passkeys")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("add-passkey").click();
  await expect(page.getByTestId("passkeys").getByRole("listitem")).toHaveCount(1, { timeout: 20_000 });
  const creds = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
  expect(creds.credentials).toHaveLength(1);
  expect(creds.credentials[0]?.rpId).toBe("localhost");

  // Sign out on the Core too, then come back with the passkey alone.
  await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("tab", { name: "Passkey" }).click();
  await page.getByLabel("Email").fill(demo.email);
  await page.getByRole("button", { name: "Continue with passkey" }).click();
  await expect(page).toHaveURL(/\/dashboard(\/settings)?$/, { timeout: 20_000 });
  const session = await page.evaluate(() => localStorage.getItem("woven:session"));
  expect(JSON.parse(session!)).toMatchObject({ email: demo.email, method: "passkey", household: demo.household, role: "owner" });

  // The Core agrees this device is signed in as the owner.
  const who = await page.evaluate(async () => {
    const r = await fetch("http://localhost:4000/v1/auth/session", { credentials: "include" });
    return r.ok ? ((await r.json()) as { person: { role: string }; passkeys: number }) : null;
  });
  expect(who).toMatchObject({ person: { role: "owner" }, passkeys: 1 });
});

test("a stranger's passkey does not open the house, and a house cannot be set up twice", async ({ page }) => {
  await virtualAuthenticator(page);
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "Recovery code" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Continue with passkey" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /No one in this household/ })).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByTestId("house-exists")).toContainText(demo.household, { timeout: 30_000 });
});
