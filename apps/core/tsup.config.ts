import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts", gate: "src/gate/process.ts", seed: "src/cli/seed.ts", "woven-backup": "src/cli/woven-backup.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  // Bundle the workspace packages so dist/ runs on its own; keep npm deps external.
  noExternal: ["@woven/schema", "@woven/hal", "@woven/policy"],
});
