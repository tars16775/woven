import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Bonjour } from "bonjour-service";
import { detectHardware } from "@woven/hal";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { CORE_HOUSEHOLD_ID, openData } from "./data.ts";
import { scheduleNightly } from "./maintenance.ts";
import { buildServices } from "./services.ts";
import { MediaService } from "./media.ts";
import { startGate } from "./gate/spawn.ts";
import { coreDnsNames, lanAddresses } from "./network.ts";
import { ensureHouseholdTls, type TlsMaterial } from "./tls.ts";
import { buildTrustServer } from "./trust.ts";

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

  // The household CA and this machine's certificate, created or renewed as needed.
  let tls: TlsMaterial | undefined;
  if (config.tls) {
    tls = await ensureHouseholdTls({ keysDir: paths.keys, dns: coreDnsNames(config.name), ips: lanAddresses() });
    if (tls.createdCa) logger.warn({ fingerprint: tls.ca.fingerprint }, "created a new household certificate authority; devices must trust it once");
    if (tls.issued) logger.info({ names: tls.server.dns, addresses: tls.server.ips, notAfter: tls.server.notAfter }, "issued the core's certificate");
  }

  // The Gate: a separate process, the only way out (ADR 0005).
  const gate = await startGate({ mode: config.gate.mode, port: config.gate.port, allow: config.gate.allow, dataRoot: config.dataRoot, logLevel: config.logLevel, logger });
  logger.info({ gate: gate.client.cached().state, allow: config.gate.allow || "(nothing)" }, gate.client.cached().state === "absent" ? "no Gate running; crossings will fail" : "Gate attached");

  const startedAt = new Date();
  const tools = await MediaService.detectTools();
  logger.info({ ffmpeg: tools.ffmpeg ?? "not found", ffprobe: tools.ffprobe ?? "not found" }, "media tools");
  const services = buildServices(data, config, gate.client, { logger, tools, hardware });
  const restart = () => {
    logger.info("restarting at the owner's request");
    void stop("restart", 75);
  };
  const app = await buildApp({ config, logger, hardware, data, services, ...(tls ? { tls } : {}), version, startedAt, logFile: join(paths.logs, "core.log"), restart });
  const scheme = tls ? "https" : "http";
  // The same API in plain HTTP, reachable only from this machine. Loopback
  // cannot be sniffed from the network, so it needs no certificate, and the
  // dashboard served from localhost:3000 works before anyone trusts the CA.
  const local = tls && config.localPort > 0 ? await buildApp({ config, logger, hardware, data, services, version, startedAt }) : null;
  const trust = tls
    ? await buildTrustServer({
        logger,
        tls,
        version,
        trustUrl: `http://${config.name}:${config.trustPort}`,
        coreUrl: `${scheme}://${config.name}:${config.port}/v1/health`,
      })
    : null;
  const stopNightly = config.env === "production" || config.env === "development" ? scheduleNightly(data, logger, { mirror: config.snapshotMirror, sweep: () => services.files.sweepUploads() }) : () => undefined;

  // Scheduled routines: once a minute, on the minute.
  const routineTimer = setInterval(() => void services.routines.tick().catch((err: unknown) => logger.warn({ err }, "routine tick failed")), 60_000);
  routineTimer.unref();

  const bonjour = config.mdns ? new Bonjour() : null;
  const stop = async (signal: string, code = 0) => {
    logger.info({ signal }, "stopping");
    stopNightly();
    clearInterval(routineTimer);
    bonjour?.unpublishAll(() => bonjour.destroy());
    await Promise.all([app.close(), trust?.close(), local?.close()]);
    await gate.stop();
    data.close();
    process.exit(code);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await app.listen({ host: config.host, port: config.port });
  if (trust) await trust.listen({ host: config.host, port: config.trustPort });
  if (local) await local.listen({ host: "127.0.0.1", port: config.localPort });

  if (bonjour) {
    // Publishing with `host` makes the responder answer A records for the
    // household name, so woven.local works without renaming the machine.
    bonjour.publish({
      name: "Woven Core",
      type: "woven",
      host: config.name,
      port: config.port,
      txt: { version, kind: identity.kind, id: identity.machineId.slice(0, 8), scheme, trust: tls ? String(config.trustPort) : "" },
    });
  }

  logger.info(
    { url: `${scheme}://${config.name}:${config.port}`, trust: trust ? `http://${config.name}:${config.trustPort}` : null, local: local ? `http://127.0.0.1:${config.localPort}` : null, dataRoot: config.dataRoot, hardware: identity.kind, ledgerRows: integrity.rows },
    "Ready.",
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
