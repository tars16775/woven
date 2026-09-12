import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  // The runtime image copies dist and nothing else; it has no node_modules
  // and never runs an install. So dist must carry every dependency inside
  // it. tsup externalises dependencies by default, which is right for a
  // library and wrong here: the first real dependency this service ever
  // had left the container unable to start. scripts/check-bundle.mjs fails
  // the build if a bare import ever survives again.
  noExternal: [/^(?!node:)/],
});
