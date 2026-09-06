import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
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
