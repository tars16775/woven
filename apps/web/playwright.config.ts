import os from "node:os";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const isCI = !!process.env.CI;
/**
 * LIVE_CORE=1 also starts a real Woven Core (apps/core) on :4000 with TLS off
 * and a scratch data root, so the dashboard's live screens are tested against
 * the real API instead of the preview data. tests/e2e/live-core.spec.ts needs it.
 */
const liveCore = process.env.LIVE_CORE === "1";
const coreData = process.env.WOVEN_DATA || `${os.tmpdir()}/woven-e2e-${process.pid}`;

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
  projects: liveCore
    ? [
        // Signs the seeded owner in once and saves the cookies; tests reuse them (helpers.ts) so one-time codes are not spent per test.
        { name: "live-setup", testMatch: /live-setup\.ts/, use: { ...devices["Desktop Chrome"] } },
        { name: "chromium", dependencies: ["live-setup"], use: { ...devices["Desktop Chrome"] } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: isCI ? "pnpm start --port 3000" : "pnpm dev --port 3000",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    ...(liveCore
      ? [
          {
            // Seed the demo household (with a known recovery code) then start the core.
            command: "pnpm exec tsx src/cli/seed.ts && pnpm exec tsx src/server.ts",
            cwd: "../core",
            url: "http://localhost:4000/v1/health",
            reuseExistingServer: !isCI,
            timeout: 120_000,
            stdout: "ignore" as const,
            stderr: "pipe" as const,
            env: {
              WOVEN_DATA: coreData,
              WOVEN_TLS: "off",
              WOVEN_MDNS: "off",
              WOVEN_PORT: "4000",
              WOVEN_HOST: "127.0.0.1",
              WOVEN_ORIGINS: baseURL,
              NODE_ENV: "production",
              LOG_LEVEL: "warn",
              WOVEN_DEMO_RECOVERY_CODE: "demo-house,demo-key-1,demo-key-2,demo-key-3,demo-key-4,demo-key-5,demo-key-6",
              // A file key for the throwaway data root, so test runs never touch the login Keychain.
              WOVEN_KEY: "file",
            },
          },
        ]
      : []),
  ],
});
