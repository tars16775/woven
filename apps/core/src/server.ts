import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Bonjour } from "bonjour-service";
import { detectHardware } from "@woven/hal";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { CORE_HOUSEHOLD_ID, openData } from "./data.ts";
import { derive, KeyStore } from "./keystore.ts";
import { RelayClient } from "./remote/client.ts";
import { relayIdentity } from "./remote/identity.ts";
import { SettingsStore } from "./settings.ts";
import { Power } from "./power.ts";
import { noteInstalledVersion } from "./update.ts";
import { access } from "node:fs/promises";
import { scheduleNightly } from "./maintenance.ts";
import { buildServices } from "./services.ts";
import { MediaService } from "./media.ts";
import { assess } from "./alerts.ts";
import { LOW_CODES } from "./auth/recovery.ts";
import { listSnapshots } from "./integrity.ts";
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

  // The household data key: everything below is encrypted under keys derived from it (gap 5).
  const key = await new KeyStore(config.keyStore, paths.keys, config.dataRoot).load();

  // Open the database (running migrations), the object store and the ledger.
  const data = await openData(paths, { key });
  const migrated = await data.store.migratePlain((n) => logger.info({ n }, "encrypting objects written before encryption"));
  if (migrated) logger.info({ objects: migrated }, "encrypted objects that were written before encryption at rest");
  const integrity = data.ledger.verify();
  if (!integrity.ok) {
    logger.fatal({ integrity }, "the ledger does not verify; refusing to start on a tampered or damaged database");
    process.exit(3);
  }
  const identity = await hardware.identity();
  const settings = new SettingsStore(paths.root, { snapshotMirror: config.snapshotMirror });
  const installed = await noteInstalledVersion(paths.root, version, data.ledger);
  if (installed.changed) logger.info({ from: installed.from, to: version }, "a new version of the Core is running");
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
    tls = await ensureHouseholdTls({ keysDir: paths.keys, dns: coreDnsNames(config.name), ips: lanAddresses(), key: derive(key, "keys") });
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
  // Remote access (gap 21): one outbound, authenticated connection to the relay; requests inside arrive here as if from the LAN.
  let relay: RelayClient | undefined;
  if (config.relay) {
    const identity = await relayIdentity(paths.keys, derive(key, "keys"));
    relay = new RelayClient({
      url: config.relay,
      identity,
      devices: services.remoteDevices,
      logger,
      subscribe: (onRow) => {
        data.ledger.on("appended", onRow);
        return () => data.ledger.off("appended", onRow);
      },
      dispatch: async (req) => {
        const res = await app.inject({ method: req.method as "GET", url: req.path, headers: req.headers, ...(req.body ? { payload: req.body } : {}) });
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (typeof v === "string") headers[k] = v;
        return { status: res.statusCode, headers, body: res.rawPayload };
      },
    });
    logger.info({ relay: config.relay, coreId: identity.coreId }, "remote access is on; connecting to the relay");
  }
  // The kill switch: off closes the Gate, drops the relay and stops the jobs below; the state survives a restart.
  const power = new Power(settings, services.gate, data.ledger, services.alerts);
  if (relay) power.attach({ onOff: () => relay.stop(), onOn: () => relay.start() });
  const app = await buildApp({ config, logger, hardware, data, services, ...(tls ? { tls } : {}), version, startedAt, logFile: join(paths.logs, "core.log"), restart, ...(relay ? { relay } : {}), settings, power });
  await power.resume();
  if (!power.on) logger.warn("the Core is switched off; only the switch answers");
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
  const stopNightly = config.env === "production" || config.env === "development" ? scheduleNightly(data, logger, {
          skip: () => !power.on,
          // The demo house does not accumulate. After the night's work the
          // process leaves; the container's start script wipes and reseeds.
          ...(config.demo ? { after: () => { logger.info("demo house: leaving so the next start is fresh"); setTimeout(() => process.exit(0), 500); } } : {}),
          mirror: () => settings.get().snapshotMirror,
          sweep: async () => (await services.files.sweepUploads()) + services.memory.sweep(),
          report: (facts) => {
            night = facts;
            void reassess();
          },
          ...(config.healthPing
            ? {
                // Opt-in and honest: version and uptime, through the Gate (woventechnology.com must be on the allow list), with a receipt that says exactly that.
                ping: async () => {
                  const host = "api.woventechnology.com";
                  const sent = `A health ping to ${host}: Woven Core ${version}, ${identity.kind}, up ${Math.round(process.uptime() / 86400)} days. Nothing about the household.`;
                  const r = await services.gate.cross({ actionId: `health-ping:${new Date().toISOString().slice(0, 10)}`, host, method: "POST", path: "/ping", body: JSON.stringify({ version, kind: identity.kind, upDays: Math.round(process.uptime() / 86400) }) });
                  data.ledger.append({ type: "gate.crossing", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "gate", sensitivity: "low", target: host, sent, payload: { capability: "core.health_ping", observed: { status: r.status, bytesOut: r.bytesOut } } });
                },
              }
            : {}),
        }) : () => undefined;

  // Alerts: what the household should hear about, reassessed every ten minutes and after the nightly job.
  let night: { ledgerOk: boolean; objectsBad: number; mirrorOk: boolean | null } = { ledgerOk: integrity.ok, objectsBad: 0, mirrorOk: null };
  const reassess = async () => {
    try {
      const mirror = settings.get().snapshotMirror;
      const [storage, snaps, mirrorPresent] = await Promise.all([hardware.storage(), listSnapshots(paths.snapshots, mirror), mirror ? access(mirror).then(() => true, () => false) : Promise.resolve(null)]);
      const certDaysLeft = tls ? Math.floor((new Date(tls.server.notAfter).getTime() - Date.now()) / 86400_000) : null;
      const lastSnapshotAgeHours = snaps[0] ? (Date.now() - new Date(snaps[0].takenAt).getTime()) / 3600_000 : null;
      const house = services.household.household();
      const lowCodes = house
        ? services.household
            .people(house.id)
            .filter((p) => p.role === "owner" || p.role === "adult")
            .map((p) => ({ name: p.name, left: services.recovery.remaining(p) }))
            .filter((p) => p.left < LOW_CODES)
        : [];
      assess(services.alerts, { diskFreeBytes: storage.freeBytes, diskTotalBytes: storage.totalBytes, ledgerOk: night.ledgerOk, objectsBad: night.objectsBad, mirrorConfigured: !!mirror, mirrorOk: night.mirrorOk, mirrorPresent, certDaysLeft, gate: services.gate.cached().state, lastSnapshotAgeHours, lowCodes });
    } catch (err) {
      logger.warn({ err }, "could not assess alerts");
    }
  };
  services.alerts.onChange = (alerts) => {
    logger.info({ alerts: alerts.map((a) => `${a.level}: ${a.title}`) }, "alerts changed");
    // Urgent ones reach the adults' devices (gap 25), through the Gate, with a receipt.
    void services.push.onAlerts(alerts).catch((err: unknown) => logger.warn({ err }, "could not push an alert"));
  };
  void reassess();
  const alertTimer = setInterval(() => void reassess(), 10 * 60_000);
  alertTimer.unref();

  // Scheduled routines: once a minute, on the minute.
  const routineTimer = setInterval(() => {
    if (power.on) void services.routines.tick().catch((err: unknown) => logger.warn({ err }, "routine tick failed"));
  }, 60_000);
  routineTimer.unref();

  const bonjour = config.mdns ? new Bonjour() : null;
  const stop = async (signal: string, code = 0) => {
    logger.info({ signal }, "stopping");
    stopNightly();
    clearInterval(routineTimer);
    clearInterval(alertTimer);
    bonjour?.unpublishAll(() => bonjour.destroy());
    relay?.stop();
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
