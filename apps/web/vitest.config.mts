import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // AppleDouble sidecars on the ExFAT volume and the e2e suite, which Playwright owns.
    exclude: ["**/node_modules/**", "**/.next/**", "**/._*", "tests/e2e/**"],
    css: false,
    clearMocks: true,
    // Worker threads start noticeably faster than forks from the ExFAT node_modules,
    // and the hard 60 s worker-start limit was being grazed under load.
    pool: "threads",
    maxWorkers: 2,
  },
});
