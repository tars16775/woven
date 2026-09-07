import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  // Bundled, so the runtime image needs no node_modules: pnpm's are symlinks
  // into a store at the repository root that the image does not carry.
  noExternal: ["ws"],
  // ws is CommonJS; bundled into an ESM output its internal require() needs defining.
  banner: { js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);' },
});
