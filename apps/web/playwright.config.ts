import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const isCI = !!process.env.CI;

/**
 * Locally the suite runs against the dev server already listening on :3000
 * (started here only if nothing is). In CI the workflow has built the app, so
 * the production server is started instead.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/._*"],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // The WebGL pages compile shaders in software on CI runners; give them room.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  outputDir: "./test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: isCI ? "pnpm start --port 3000" : "pnpm dev --port 3000",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
