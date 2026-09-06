import { Alert, BackupStatus, CoreConfig, CoreStatus, StorageHealth, UpdateCheck } from "@woven/schema";
import { z } from "zod";
import { writeDiagnostics } from "../diagnostics.ts";
import { requireRole, requireSession } from "../auth/guard.ts";
import { listSnapshots, restoreDrill } from "../integrity.ts";
import { checkForUpdate } from "../update.ts";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { takeSnapshot } from "../snapshot.ts";
import { mirrorSnapshot } from "../integrity.ts";
import { CORE_HOUSEHOLD_ID } from "../data.ts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * What the Core page and the Overview card show: identity and live metrics
 * straight from the hardware layer. Authentication arrives in phase 8; until
 * then this is LAN-only by virtue of where the core listens.
 */
export const systemRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.get(
    "/system/status",
    { preHandler: requireSession, schema: { response: { 200: CoreStatus } } },
    async () => {
      const { hardware, version, startedAt, config } = app.deps;
      const [identity, metrics] = await Promise.all([hardware.identity(), hardware.metrics()]);
      return CoreStatus.parse({
        version,
        startedAt: startedAt.toISOString(),
        hardware: identity,
        metrics,
        gate: app.deps.services.gate.cached().state,
        dataRoot: config.dataRoot,
      });
    },
  );

  app.get("/system/config", { preHandler: requireSession, schema: { response: { 200: CoreConfig } } }, async () => {
    const { config, version, tls } = app.deps;
    return CoreConfig.parse({
      version,
      name: config.name,
      port: config.port,
      origins: config.origins,
      mdns: config.mdns,
      tls: tls
        ? {
            enabled: true,
            caFingerprint: tls.ca.fingerprint,
            caNotAfter: tls.ca.notAfter,
            serverNotAfter: tls.server.notAfter,
            names: tls.server.dns,
            addresses: tls.server.ips,
            trustUrl: `http://${config.name}:${config.trustPort}`,
          }
        : { enabled: false },
    });
  });

  /* Backups and the restore drill (phase 23) */
  let lastDrill: BackupStatus["lastDrill"] = null;
  const mirror = () => app.deps.settings?.get().snapshotMirror ?? app.deps.config.snapshotMirror;
  const backupStatus = async (): Promise<BackupStatus> => ({
    snapshots: (await listSnapshots(app.deps.data.paths.snapshots, mirror())).slice(0, 30),
    mirror: mirror(),
    mirrorPresent: mirror() ? await access(mirror()!).then(() => true, () => false) : null,
    lastDrill,
  });

  /** The second location (gap 23): a folder on another drive, set from the dashboard. Checked to be a writable folder first. */
  app.post("/system/backups/mirror", { preHandler: requireRole("owner"), schema: { body: z.object({ path: z.string().trim().max(1000).nullable() }), response: { 200: BackupStatus } } }, async (req) => {
    const { data, settings } = app.deps;
    if (!settings) throw Object.assign(new Error("Settings are not available on this Core."), { statusCode: 409 });
    const path = req.body.path?.replace(/\/+$/, "") || null;
    if (path) {
      if (path.startsWith(data.paths.root)) throw Object.assign(new Error("The second location has to be outside the data folder, on another drive if you can."), { statusCode: 400 });
      const probe = join(path, `.woven-write-test-${Date.now()}`);
      try {
        await mkdir(path, { recursive: true });
        await writeFile(probe, "ok");
        await rm(probe, { force: true });
      } catch {
        throw Object.assign(new Error(`Cannot write to ${path}. Is the drive connected?`), { statusCode: 400 });
      }
    }
    settings.set({ snapshotMirror: path });
    data.ledger.append({ type: "action.executed", householdId: req.session!.person.householdId || CORE_HOUSEHOLD_ID, actor: { kind: "person", id: req.session!.person.id }, where: "inside", target: "snapshots", sensitivity: "low", payload: { capability: "backup.mirror", planned: { path }, observed: { path } } });
    return backupStatus();
  });

  /** Updates (gap 22): ask GitHub, through the Gate, whether a newer signed release exists. */
  app.post("/system/update/check", { preHandler: requireRole("owner"), schema: { response: { 200: UpdateCheck } } }, async () => checkForUpdate(app.deps.services.gate, app.deps.data.ledger, app.deps.version));
  app.get("/system/backups", { preHandler: requireRole("owner", "adult"), schema: { response: { 200: BackupStatus } } }, async () => backupStatus());

  app.post("/system/backups/snapshot", { preHandler: requireRole("owner"), schema: { response: { 200: BackupStatus } } }, async (req) => {
    const { data } = app.deps;
    const snap = await takeSnapshot({ db: data.database, objectsDir: data.paths.store, snapshotsDir: data.paths.snapshots, keysDir: data.paths.keys });
    let mirrored = false;
    if (mirror()) mirrored = (await mirrorSnapshot(snap.dir, mirror()!).catch(() => ({ copied: false }))).copied;
    data.ledger.append({ type: "action.executed", householdId: req.session!.person.householdId || CORE_HOUSEHOLD_ID, actor: { kind: "person", id: req.session!.person.id }, where: "inside", target: "snapshot", sensitivity: "low", payload: { capability: "backup.snapshot", planned: {}, observed: { objects: snap.manifest.objects.count, mirrored } } });
    return backupStatus();
  });

  app.post("/system/backups/drill", { preHandler: requireRole("owner"), schema: { response: { 200: BackupStatus } } }, async (req) => {
    const { data } = app.deps;
    const report = await restoreDrill(data.paths.snapshots, mirror(), data.key);
    lastDrill = { ...report, at: new Date().toISOString() };
    data.ledger.append({ type: "core.integrity_checked", householdId: req.session!.person.householdId || CORE_HOUSEHOLD_ID, actor: { kind: "person", id: req.session!.person.id }, where: "inside", target: report.snapshot, sensitivity: "low", payload: { drill: true, ok: report.ok, rows: report.ledger.rows, objects: report.objects.checked, problem: report.problem } });
    return backupStatus();
  });

  /* Core management (phase 45) */
  app.get("/system/storage", { preHandler: requireRole("owner", "adult"), schema: { response: { 200: StorageHealth } } }, async () => app.deps.hardware.storage());

  app.post("/system/diagnostics", { preHandler: requireRole("owner"), schema: { response: { 200: z.object({ dir: z.string(), files: z.array(z.string()), takenAt: z.string() }) } } }, async () =>
    writeDiagnostics({ data: app.deps.data, services: app.deps.services, hardware: app.deps.hardware, config: app.deps.config, version: app.deps.version, startedAt: app.deps.startedAt, logFile: app.deps.logFile ?? null }),
  );

  /** Restart the core process. The supervisor (tools/woven-core.sh) starts it again; the dashboard waits for health. */
  app.post("/system/restart", { preHandler: requireRole("owner"), schema: { response: { 202: z.object({ restarting: z.literal(true) }) } } }, async (req, reply) => {
    const p = req.session!.person;
    app.deps.data.ledger.append({ type: "action.executed", householdId: p.householdId, actor: { kind: "person", id: p.id }, where: "inside", target: "core", sensitivity: "low", payload: { capability: "core.restart", planned: {}, observed: { restarting: true } } });
    void reply.status(202).send({ restarting: true as const });
    setTimeout(() => app.deps.restart?.(), 300).unref();
  });

  /* Observability (phase 47): counts by route pattern, never by person or path. */
  app.get("/system/metrics", { preHandler: requireRole("owner", "adult"), schema: { response: { 200: z.object({ uptimeSeconds: z.number().int(), requests: z.array(z.object({ key: z.string(), count: z.number().int(), avgMs: z.number(), maxMs: z.number() })), counters: z.record(z.string(), z.number()) }) } } }, async () => app.deps.services.metrics.snapshot());
  app.get("/system/alerts", { preHandler: requireSession, schema: { response: { 200: z.object({ alerts: z.array(Alert) }) } } }, async () => ({ alerts: app.deps.services.alerts.list() }));
};
