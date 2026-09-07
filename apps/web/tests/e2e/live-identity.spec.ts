import { expect, test, type Page } from "@playwright/test";
import { demo, signInWithOwnCode, signInWithPasskey } from "./helpers";

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
    // Sessions are bound to the device (gap 3): the secret the page keeps goes along as a header.
    const r = await fetch("http://localhost:4000/v1/auth/session", { credentials: "include", headers: { "x-woven-device": localStorage.getItem("woven:device") ?? "" } });
    return r.ok ? ((await r.json()) as { person: { role: string }; passkeys: number }) : null;
  });
  expect(who).toMatchObject({ person: { role: "owner" }, passkeys: 1 });
});

test("a stranger's passkey does not open the house, and a house cannot be set up twice", async ({ page }) => {
  await virtualAuthenticator(page);
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "I lost my devices" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Continue with passkey" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /No one in this household/ })).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByTestId("house-exists")).toContainText(demo.household, { timeout: 30_000 });
});

test("invite a member by link, join with a passkey, sign in by the screen code, export your data", async ({ page, browser }) => {
  await signInWithOwnCode(page);
  await page.goto("/dashboard/settings");
  await page.getByTestId("invite").click({ timeout: 30_000 });
  await page.getByRole("dialog").getByRole("textbox", { name: "Name" }).fill("Priya");
  await page.getByRole("textbox", { name: /Email/ }).fill("priya@example.com");
  await page.getByRole("button", { name: "Make an invitation link" }).click();
  const link = (await page.getByTestId("invite-link").textContent({ timeout: 15_000 }))!.trim();
  expect(link).toMatch(/\/join\?token=/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("members")).toContainText("Priya");
  await expect(page.getByTestId("members")).toContainText("Pending");

  // Priya opens the link on her own device (a fresh context with its own authenticator).
  const her = await browser.newContext();
  const herPage = await her.newPage();
  await virtualAuthenticator(herPage);
  await herPage.goto(link);
  await herPage.getByTestId("join").click({ timeout: 30_000 });
  await expect(herPage).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  const herSession = await herPage.evaluate(() => localStorage.getItem("woven:session"));
  expect(JSON.parse(herSession!)).toMatchObject({ name: "Priya", role: "adult", method: "passkey" });
  await her.close();

  // A child without email signs in with the code on the box's screen (read from loopback, as the screen itself would).
  await page.getByTestId("invite").click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Name" }).fill("Sam Junior");
  await page.getByRole("dialog").getByRole("combobox").selectOption("child");
  await page.getByRole("button", { name: "Make an invitation link" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  const code = await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:4000/v1/screen/code", { cache: "no-store" });
    return ((await r.json()) as { code: string }).code;
  });
  const kid = await browser.newContext();
  const kidPage = await kid.newPage();
  await kidPage.goto("/login");
  await kidPage.getByRole("tab", { name: "Code on the screen" }).click({ timeout: 30_000 });
  await expect(kidPage.getByRole("tab", { name: "I lost my devices" })).toBeVisible({ timeout: 30_000 });
  await kidPage.getByLabel("Your name").fill("Sam Junior");
  for (let i = 0; i < 6; i += 1) await kidPage.getByLabel(`Digit ${i + 1} of 6`).fill(code[i]!);
  await expect(kidPage).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  const kidSession = await kidPage.evaluate(() => localStorage.getItem("woven:session"));
  expect(JSON.parse(kidSession!)).toMatchObject({ name: "Sam Junior", role: "child", method: "code" });
  await kid.close();

  // The owner exports their own data; the toast names the folder on the box.
  await page.getByTestId("export-me").click();
  await expect(page.getByText(/Exported \d+ files and \d+ receipts to/)).toBeVisible({ timeout: 20_000 });
});

test("memory is the person's own: tell, keep, forget, and set retention", async ({ page }) => {
  // The shared owner session is enough here; own codes are for tests that sign out.
  await signInWithPasskey(page);
  await page.goto("/dashboard/privacy");
  await page.getByTestId("add-memory").click({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "In your words" }).fill("I take my coffee black");
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByTestId("memories")).toContainText("I take my coffee black", { timeout: 15_000 });
  await page.getByRole("combobox", { name: "Retention" }).selectOption("forever");
  await expect(page.getByTestId("memories")).toContainText("kept until you delete it", { timeout: 15_000 });
  await page.getByRole("button", { name: "Forget: I take my coffee black" }).click();
  await expect(page.getByTestId("no-memory")).toBeVisible({ timeout: 15_000 });
});
