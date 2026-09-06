import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { Bonjour } from "bonjour-service";
import { detectHardware } from "@woven/hal";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { CORE_HOUSEHOLD_ID, openData } from "./data.ts";
import { scheduleNightly } from "./maintenance.ts";

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

  // Open the database (running migrations), the object store and the ledger.
  const data = await openData(paths);
  const integrity = data.ledger.verify();
  if (!integrity.ok) {
    logger.fatal({ integrity }, "the ledger does not verify; refusing to start on a tampered or damaged database");
    process.exit(3);
  }
  const identity = await hardware.identity();
  data.ledger.append({
    type: "core.started",
    householdId: CORE_HOUSEHOLD_ID,
    actor: { kind: "core", id: "core" },
    where: "inside",
    sensitivity: "low",
    payload: { version, kind: identity.kind, ledgerRows: integrity.rows },
  });

  const app = await buildApp({ config, logger, hardware, data, version, startedAt: new Date() });
  const stopNightly = config.env === "production" || config.env === "development" ? scheduleNightly(data, logger) : () => undefined;

  const bonjour = config.mdns ? new Bonjour() : null;
  const stop = async (signal: string) => {
    logger.info({ signal }, "stopping");
    stopNightly();
    bonjour?.unpublishAll(() => bonjour.destroy());
    await app.close();
    data.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await app.listen({ host: config.host, port: config.port });

  if (bonjour) {
    bonjour.publish({
      name: "Woven Core",
      type: "woven",
      port: config.port,
      txt: { version, kind: identity.kind, id: identity.machineId.slice(0, 8) },
    });
  }

  logger.info({ port: config.port, dataRoot: config.dataRoot, hardware: identity.kind, ledgerRows: integrity.rows }, "Ready.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
