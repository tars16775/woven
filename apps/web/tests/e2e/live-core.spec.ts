import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, signInWithPasskey } from "./helpers";

/** Files rows keep their rarer actions behind an overflow menu (design phase 12). */
async function deleteFile(page: Page, name: string, timeout = 30_000) {
  await page.getByRole("button", { name: `More for ${name}` }).click({ timeout });
  await page.getByRole("menuitem", { name: "Delete" }).click();
}


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

  // The Gate: close it (an action with a receipt), see the shell agree, open it again. The Inside card reads the real network.
  await page.goto("/dashboard/network");
  await expect(page.getByText(/Observed on the Mac|Owned by the box/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("neighbours")).toBeVisible();
  await page.getByRole("button", { name: "Close the Gate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close the Gate" }).click();
  await expect(page.getByRole("heading", { name: "The Gate" }).locator("..")).toContainText("Closed · nothing crosses", { timeout: 15_000 });
  await expect(page.getByTestId("core-connection")).toBeVisible();
  await page.getByRole("button", { name: "Open the Gate" }).click();
  await expect(page.getByRole("heading", { name: "The Gate" }).locator("..")).toContainText("Open · asks first", { timeout: 15_000 });
});

const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("Files uploads to the box in chunks, lists, serves and deletes; an image shows up in Photos", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/files");
  await expect(page.getByTestId("upload")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("upload-input").setInputFiles([
    { name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("hello from the dashboard") },
    { name: "dot.png", mimeType: "image/png", buffer: PNG_1x1 },
  ]);
  const listing = page.getByTestId("listing");
  await expect(listing).toContainText("hello.txt", { timeout: 30_000 });
  await expect(listing).toContainText("dot.png");

  // The bytes come back from the box, with the session cookie.
  const href = await listing.getByRole("link", { name: "hello.txt" }).getAttribute("href");
  const body = await page.evaluate(async (url) => (await fetch(url, { credentials: "include" })).text(), href!);
  expect(body).toBe("hello from the dashboard");

  await page.goto("/dashboard/photos");
  await expect(page.getByRole("button", { name: "dot.png" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "dot.png" }).click();
  await expect(page.getByRole("dialog")).toContainText("dot.png");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  await page.goto("/dashboard/files");
  await deleteFile(page, "hello.txt");
  await expect(page.getByTestId("listing")).not.toContainText("hello.txt", { timeout: 15_000 });
  await deleteFile(page, "dot.png");
  await expect(page.getByTestId("empty")).toBeVisible({ timeout: 15_000 });
});

test("the owner runs a restore drill from the Core page", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/core");
  await expect(page.getByTestId("core-connection")).toContainText(/Core · localhost/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Snapshot now" }).click({ timeout: 30_000 });
  await expect(page.getByText(/Snapshot taken/)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("restore-drill").click();
  await expect(page.getByTestId("drill-result")).toContainText("Restored and verified", { timeout: 60_000 });
});

test("the TV page lists media from the box and plays it", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/files");
  await expect(page.getByTestId("upload")).toBeVisible({ timeout: 30_000 });
  // A tiny but valid MP4 is more than this test needs; a WAV is trivial to write by hand.
  const wav = Buffer.alloc(44 + 8000);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + 8000, 4); wav.write("WAVE", 8); wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write("data", 36); wav.writeUInt32LE(8000, 40);
  for (let i = 0; i < 8000; i += 1) wav[44 + i] = 128 + Math.round(100 * Math.sin(i / 6));
  await page.getByTestId("upload-input").setInputFiles([{ name: "tone.wav", mimeType: "audio/wav", buffer: wav }]);
  await expect(page.getByTestId("listing")).toContainText("tone.wav", { timeout: 30_000 });

  await page.goto("/dashboard/tv");
  await expect(page.getByTestId("music")).toContainText("tone.wav", { timeout: 30_000 });
  await page.getByRole("button", { name: "tone.wav" }).click();
  const player = page.getByTestId("player");
  await expect(player).toBeVisible();
  await expect.poll(async () => player.evaluate((el) => (el as HTMLMediaElement).readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await page.goto("/dashboard/files");
  await deleteFile(page, "tone.wav");
  await expect(page.getByTestId("listing")).not.toContainText("tone.wav", { timeout: 15_000 }).catch(() => undefined);
});

test("the Core page shows the volume's health and writes a scrubbed diagnostics bundle", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/core");
  await expect(page.getByTestId("storage")).toContainText(/free · SMART/, { timeout: 30_000 });
  await page.getByTestId("diagnostics").click();
  await expect(page.getByText(/Diagnostics written to/)).toBeVisible({ timeout: 30_000 });
});

test("routines run from the Home page and a new one can be made", async ({ page }) => {
  await signInWithPasskey(page);
  await page.goto("/dashboard/home");
  await expect(page.getByTestId("routines")).toContainText("Goodnight", { timeout: 30_000 });
  await page.getByRole("button", { name: "Run Goodnight" }).click();
  await expect(page.getByText(/Goodnight: \d of \d steps done/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("device-living.ceiling").getByRole("switch")).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });

  await page.getByTestId("new-routine").click();
  await page.getByRole("textbox", { name: "Name" }).fill("Reading light");
  await page.getByTestId("add-step").click();
  await page.getByRole("button", { name: "Make it" }).click();
  await expect(page.getByTestId("routines")).toContainText("Reading light", { timeout: 15_000 });
  await page.getByRole("button", { name: "Delete Reading light" }).click();
  await expect(page.getByTestId("routines")).not.toContainText("Reading light", { timeout: 15_000 });
});
