import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Most suites open a real encrypted database in beforeAll, which runs every
    // migration under chacha20. On a fast SSD that is a second; on an external
    // drive with thirty files opening at once it can pass ten. A timeout is the
    // wrong failure for a slow disk, so the hook gets a minute. A hook that
    // genuinely hangs still fails; it just takes longer to say so.
    hookTimeout: 60_000,
    // The coverage floor (gap 27): `pnpm test:coverage` fails below it. Numbers rise with the code, never fall.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/**", "src/server.ts", "src/types/**"],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
      reporter: ["text-summary", "html"],
    },
  },
});
