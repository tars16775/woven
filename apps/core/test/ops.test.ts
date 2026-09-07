import { mkdtempSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import type { BackupStatus, FilesSummary, Person } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { SettingsStore } from "../src/settings.ts";
import { isNewer, noteInstalledVersion } from "../src/update.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-ops-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let settings: SettingsStore;
let owner: Auth = { cookie: "", device: "" };
let maya: Auth = { cookie: "", device: "" };
let mayaId = "";

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware });
  settings = new SettingsStore(dataRoot, { snapshotMirror: null });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date(), settings });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
  const made = await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
  mayaId = made.json<{ id: string }>().id;
  const mayaPerson = services.household.personByEmail("maya@example.com")!;
  maya = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code: services.recovery.issue(mayaPerson)[0] } }));
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("storage quotas (gap 24)", () => {
  it("lets the owner set a quota, shows usage against it, and refuses what would go over", async () => {
    const put = (who: Auth, name: string, size: number) => app.inject({ method: "POST", url: "/v1/files/uploads", headers: auth(who), payload: { name, path: "/", namespace: "personal", size, source: "test" } });
    expect((await put(maya, "a.bin", 600)).statusCode).toBe(201);
    const mayaPerson = services.household.personByEmail("maya@example.com")!;
    await services.files.put(mayaPerson, { name: "kept.bin", path: "/", namespace: "personal" }, Buffer.alloc(600));
    // Only the owner sets quotas.
    expect((await app.inject({ method: "POST", url: `/v1/household/people/${mayaId}/quota`, headers: auth(maya), payload: { quotaBytes: 1000 } })).statusCode).toBe(403);
    const set = await app.inject({ method: "POST", url: `/v1/household/people/${mayaId}/quota`, headers: auth(owner), payload: { quotaBytes: 1000 } });
    expect(set.statusCode).toBe(200);
    expect(set.json<Person>().quotaBytes).toBe(1000);
    const over = await put(maya, "b.bin", 500);
    expect(over.statusCode).toBe(413);
    expect(over.json<{ error: string }>().error).toMatch(/over the storage quota/);
    expect((await put(maya, "c.bin", 300)).statusCode).toBe(201);
    expect(data.ledger.recent(undefined, 10).some((r) => r.type === "action.declined" && (r.payload as { reason?: string }).reason === "over quota")).toBe(true);
    const summary = (await app.inject({ method: "GET", url: "/v1/files/summary", headers: auth(owner) })).json<FilesSummary>();
    expect(summary.byPerson.find((p) => p.personId === mayaId)).toMatchObject({ name: "Maya", bytes: 600, quotaBytes: 1000 });
    expect(summary.byPerson.length).toBe(2);
    // Lifting it.
    expect((await app.inject({ method: "POST", url: `/v1/household/people/${mayaId}/quota`, headers: auth(owner), payload: { quotaBytes: null } })).json<Person>().quotaBytes).toBeNull();
    expect((await put(maya, "d.bin", 5000)).statusCode).toBe(201);
  });
});

describe("the second snapshot location (gap 23)", () => {
  it("is set from the dashboard, checked to be writable, and reported when absent", async () => {
    const mirror = join(os.tmpdir(), `woven-mirror-${Date.now()}`);
    await mkdir(mirror, { recursive: true });
    const inside = await app.inject({ method: "POST", url: "/v1/system/backups/mirror", headers: auth(owner), payload: { path: join(dataRoot, "mirror") } });
    expect(inside.statusCode).toBe(400);
    const set = await app.inject({ method: "POST", url: "/v1/system/backups/mirror", headers: auth(owner), payload: { path: mirror } });
    expect(set.statusCode).toBe(200);
    expect(set.json<BackupStatus>()).toMatchObject({ mirror, mirrorPresent: true });
    expect(settings.get().snapshotMirror).toBe(mirror);
    expect(JSON.parse(await readFile(join(dataRoot, "settings.json"), "utf8"))).toMatchObject({ snapshotMirror: mirror, power: "on" });
    // A snapshot taken now is copied there.
    const snap = await app.inject({ method: "POST", url: "/v1/system/backups/snapshot", headers: auth(owner) });
    expect(snap.json<BackupStatus>().snapshots[0]?.mirrored).toBe(true);
    // The drive goes away: the status says so.
    await rm(mirror, { recursive: true, force: true });
    expect((await app.inject({ method: "GET", url: "/v1/system/backups", headers: auth(owner) })).json<BackupStatus>().mirrorPresent).toBe(false);
    // Adults cannot change it; turning it off works.
    expect((await app.inject({ method: "POST", url: "/v1/system/backups/mirror", headers: auth(maya), payload: { path: null } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/system/backups/mirror", headers: auth(owner), payload: { path: null } })).json<BackupStatus>().mirror).toBeNull();
    // A second store on the same file reads the choice back.
    expect(new SettingsStore(dataRoot, { snapshotMirror: "/should/not/override" }).get().snapshotMirror).toBeNull();
  });
});

describe("updates (gap 22)", () => {
  it("compares versions and notes an installed update in the ledger", async () => {
    expect(isNewer("0.2.0", "0.1.9")).toBe(true);
    expect(isNewer("0.1.10", "0.1.9")).toBe(true);
    expect(isNewer("0.1.9", "0.1.9")).toBe(false);
    expect(isNewer("0.1.8", "0.1.9")).toBe(false);
    const root = mkdtempSync(`${os.tmpdir()}/woven-ver-`);
    expect(await noteInstalledVersion(root, "0.1.0", data.ledger)).toEqual({ from: null, changed: false });
    expect(await noteInstalledVersion(root, "0.1.0", data.ledger)).toEqual({ from: "0.1.0", changed: false });
    expect(await noteInstalledVersion(root, "0.2.0", data.ledger)).toEqual({ from: "0.1.0", changed: true });
    expect(data.ledger.recent(undefined, 3).find((r) => r.type === "update.installed")?.payload).toEqual({ from: "0.1.0", to: "0.2.0" });
    // Without a Gate the check fails cleanly.
    expect((await app.inject({ method: "POST", url: "/v1/system/update/check", headers: auth(owner) })).statusCode).toBe(503);
    await rm(root, { recursive: true, force: true });
  });
});
