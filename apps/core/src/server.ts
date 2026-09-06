import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { Bonjour } from "bonjour-service";
import { detectHardware } from "@woven/hal";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  const hardware = detectHardware({ dataRoot: config.dataRoot });

  // The data root and its layout exist before anything else runs. Keys are private.
  const { paths } = hardware;
  for (const dir of [paths.db, paths.store, paths.storeTmp, paths.snapshots, paths.logs]) {
    await mkdir(dir, { recursive: true });
  }
  await mkdir(paths.keys, { recursive: true, mode: 0o700 });

  const app = await buildApp({ config, logger, hardware, version, startedAt: new Date() });

  const bonjour = config.mdns ? new Bonjour() : null;
  const stop = async (signal: string) => {
    logger.info({ signal }, "stopping");
    bonjour?.unpublishAll(() => bonjour.destroy());
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await app.listen({ host: config.host, port: config.port });

  if (bonjour) {
    const identity = await hardware.identity();
    bonjour.publish({
      name: "Woven Core",
      type: "woven",
      port: config.port,
      txt: { version, kind: identity.kind, id: identity.machineId.slice(0, 8) },
    });
  }

  logger.info({ port: config.port, dataRoot: config.dataRoot, hardware: (await hardware.identity()).kind }, "Ready.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
