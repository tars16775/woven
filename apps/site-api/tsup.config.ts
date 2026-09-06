import { defineConfig } from "tsup";

export default defineConfig({ entry: { server: "src/server.ts" }, format: ["esm"], target: "node22", platform: "node", clean: true });
