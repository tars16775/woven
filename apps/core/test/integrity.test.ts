import { mkdtempSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth } from "./helpers.ts";
import { listSnapshots, restoreDrill, verifyStore } from "../src/integrity.ts";
import { runNightly } from "../src/maintenance.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-integrity-`);
const mirror = mkdtempSync(`${os.tmpdir()}/woven-mirror-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off", WOVEN_SNAPSHOT_MIRROR: mirror });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"));
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
  const alex = services.household.personByEmail("alex@example.com")!;
  for (let i = 0; i < 5; i += 1) await services.files.put(alex, { name: `f${i}.txt`, path: "/", namespace: "personal" }, Buffer.from(`file ${i}`));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
  await rm(mirror, { recursive: true, force: true });
});

describe("integrity and restore (phase 23)", () => {
  it("verifies every object and notices one that changed on disk", async () => {
    const clean = await verifyStore(data.database.db, data.store);
    expect(clean).toMatchObject({ checked: 5, total: 5, corrupt: [], missing: [], sampled: false });
    const victim = createHash("sha256").update("file 2").digest("hex");
    await writeFile(data.store.pathFor(victim), "bit rot");
    const bad = await verifyStore(data.database.db, data.store);
    expect(bad.corrupt).toEqual([victim]);
    await rm(data.store.pathFor(victim), { force: true });
    expect((await verifyStore(data.database.db, data.store)).missing).toEqual([victim]);
    // The bytes come back (a backup client re-sends them) and the store is whole again.
    await data.store.put(Buffer.from("file 2"));
    expect(await verifyStore(data.database.db, data.store)).toMatchObject({ corrupt: [], missing: [] });
  });

  it("samples above a threshold", async () => {
    const r = await verifyStore(data.database.db, data.store, { sampleAbove: 2, sample: 3 });
    expect(r).toMatchObject({ checked: 3, total: 5, sampled: true });
  });

  it("the nightly job verifies, snapshots, mirrors and records a receipt", async () => {
    await runNightly(data, createLogger(config), 14, { mirror });
    const snaps = await listSnapshots(data.paths.snapshots, mirror);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ objects: 5, mirrored: true });
    const receipt = data.ledger.recent(undefined, 1)[0]!;
    expect(receipt.type).toBe("core.integrity_checked");
    expect(receipt.payload).toMatchObject({ ok: true, objects: { checked: 5, corrupt: 0, missing: 0 }, nightly: true });
  });

  it("the restore drill restores the newest snapshot into scratch and verifies it", async () => {
    const report = await restoreDrill(data.paths.snapshots, mirror);
    expect(report.ok).toBe(true);
    expect(report.ledger.rows).toBeGreaterThanOrEqual(3);
    expect(report.objects).toMatchObject({ checked: 5, corrupt: [], missing: [] });
    expect(report.problem).toBeNull();
  });

  it("owners run it from the dashboard; adults may look, children may not", async () => {
    const status = await app.inject({ method: "GET", url: "/v1/system/backups", headers: auth(owner) });
    expect(status.json()).toMatchObject({ mirror, lastDrill: null });
    expect(status.json<{ snapshots: unknown[] }>().snapshots).toHaveLength(1);
    const drill = await app.inject({ method: "POST", url: "/v1/system/backups/drill", headers: auth(owner) });
    expect(drill.statusCode).toBe(200);
    expect(drill.json<{ lastDrill: { ok: boolean } }>().lastDrill.ok).toBe(true);
    const snap = await app.inject({ method: "POST", url: "/v1/system/backups/snapshot", headers: auth(owner) });
    expect(snap.json<{ snapshots: { mirrored: boolean }[] }>().snapshots).toHaveLength(2);
    expect(snap.json<{ snapshots: { mirrored: boolean }[] }>().snapshots[0]?.mirrored).toBe(true);
    await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Sam", email: "sam@example.com", role: "child" } });
    const sam = services.household.personByEmail("sam@example.com")!;
    const child = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "sam@example.com", code: services.recovery.issue(sam)[0] } }));
    expect((await app.inject({ method: "GET", url: "/v1/system/backups", headers: auth(child) })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/system/backups/drill", headers: auth(child) })).statusCode).toBe(403);
  });
});
