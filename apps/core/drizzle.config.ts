import { defineConfig } from "drizzle-kit";

/** Migration generation only; the core applies migrations itself at start. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
