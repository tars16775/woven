import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { SESSION_COOKIE } from "../src/auth/sessions.ts";
import { Alerts, assess } from "../src/alerts.ts";
import { MemoryService } from "../src/memory.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-memory-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner = "";
let maya = "";
type M = { id: string; text: string; status: string; seen: number; expiresAt: string | null };
const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const list: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((x) => x.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ?? "";
};

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"), { hardware, mdns: false });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = cookieOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
  await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie: owner }, payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
  const m = services.household.personByEmail("maya@example.com")!;
  maya = cookieOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code: services.recovery.issue(m)[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("memory (phase 36)", () => {
  it("what a person says is kept; what Tandem overhears is a candidate until it comes up again", async () => {
    const said = await app.inject({ method: "POST", url: "/v1/memory", headers: { cookie: owner }, payload: { text: "I take my coffee black", kind: "preference" } });
    expect(said.statusCode).toBe(201);
    expect(said.json<M>()).toMatchObject({ status: "durable" });
    const alex = services.household.personByEmail("alex@example.com")!;
    const heard = services.memory.notice(alex, { text: "Dentist is on the 14th", kind: "event" });
    expect(heard.status).toBe("candidate");
    expect(heard.expiresAt).not.toBeNull();
    const durableOnly = await app.inject({ method: "GET", url: "/v1/memory?candidates=false", headers: { cookie: owner } });
    expect(durableOnly.json<{ memories: M[] }>().memories.map((x) => x.text)).toEqual(["I take my coffee black"]);
    const again = services.memory.notice(alex, { text: "Dentist is on the 14th", kind: "event" });
    expect(again).toMatchObject({ status: "durable", seen: 2 });
    expect(data.ledger.recent(undefined, 1)[0]).toMatchObject({ type: "memory.created", sensitivity: "high" });
    expect(JSON.stringify(data.ledger.recent(undefined, 3))).not.toContain("Dentist"); // receipts never carry the text
  });

  it("is private even from the owner, and edit, confirm and forget are the person's own", async () => {
    const mine = await app.inject({ method: "POST", url: "/v1/memory", headers: { cookie: maya }, payload: { text: "My sister's birthday is in May" } });
    const id = mine.json<M>().id;
    const ownerList = await app.inject({ method: "GET", url: "/v1/memory", headers: { cookie: owner } });
    expect(JSON.stringify(ownerList.json())).not.toContain("sister");
    expect((await app.inject({ method: "PATCH", url: `/v1/memory/${id}`, headers: { cookie: owner }, payload: { text: "x" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PATCH", url: `/v1/memory/${id}`, headers: { cookie: maya }, payload: { text: "My sister's birthday is 12 May" } })).json<M>().text).toBe("My sister's birthday is 12 May");
    expect((await app.inject({ method: "DELETE", url: `/v1/memory/${id}`, headers: { cookie: maya } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/memory", headers: { cookie: maya } })).json<{ memories: M[] }>().memories).toHaveLength(0);
    expect(data.ledger.recent(undefined, 1)[0]?.type).toBe("memory.deleted");
  });

  it("retention forgets on time, and a changed setting applies to what is already there", () => {
    let t = Date.parse("2026-09-06T12:00:00Z");
    const svc = new MemoryService(data.database.db, data.ledger, () => new Date(t));
    const alex = services.household.personByEmail("alex@example.com")!;
    svc.forgetAll(alex);
    const m = svc.remember(alex, { text: "Keep this a year", kind: "fact" });
    expect(m.expiresAt).toBe(new Date(t + 365 * 86400_000).toISOString());
    const c = svc.notice(alex, { text: "passing remark", kind: "fact" });
    t += 8 * 86400_000; // a week and a day
    expect(svc.list(alex, { includeCandidates: true }).map((x) => x.id)).toEqual([m.id]); // the candidate is gone
    void c;
    svc.setSettings(alex, { retentionDays: 1, candidateDays: 7 });
    t += 2 * 86400_000;
    expect(svc.list(alex)).toHaveLength(0);
    svc.setSettings(alex, { retentionDays: null, candidateDays: 7 });
    expect(svc.remember(alex, { text: "forever", kind: "fact" }).expiresAt).toBeNull();
  });
});

describe("alerts and metrics (phases 44 and 47)", () => {
  it("raises what matters, clears when it passes, and keeps the first time it was seen", () => {
    const a = new Alerts();
    const base = { diskFreeBytes: 500e9, diskTotalBytes: 1e12, ledgerOk: true, objectsBad: 0, mirrorConfigured: true, mirrorOk: true, certDaysLeft: 200, gate: "open" as const, lastSnapshotAgeHours: 5 };
    assess(a, base);
    expect(a.list()).toEqual([]);
    assess(a, { ...base, diskFreeBytes: 20e9, ledgerOk: false });
    expect(a.list().map((x) => `${x.level}:${x.id}`).sort()).toEqual(["urgent:disk", "urgent:ledger"]);
    const since = a.list().find((x) => x.id === "ledger")!.since;
    assess(a, { ...base, diskFreeBytes: 60e9, ledgerOk: false });
    expect(a.list().map((x) => `${x.level}:${x.id}`)).toEqual(["urgent:ledger", "warn:disk"]);
    expect(a.list()[0]!.since).toBe(since);
    assess(a, { ...base, mirrorConfigured: false, gate: "absent", certDaysLeft: 3, lastSnapshotAgeHours: 80 });
    expect(a.list().map((x) => x.id).sort()).toEqual(["cert", "gate", "no-mirror", "snapshot"]);
  });

  it("the screen shows state, code, chips, alerts and recent activity, on loopback only", async () => {
    services.alerts.raise("disk", "warn", "The volume is filling up", "9% free.");
    const res = await app.inject({ method: "GET", url: "/v1/screen/state", remoteAddress: "127.0.0.1" });
    expect(res.statusCode).toBe(200);
    const s = res.json<{ state: string; code: string; alerts: unknown[]; activity: { title: string }[]; household: string }>();
    expect(s.household).toBe("H");
    expect(s.state).toBe("ready");
    expect(s.code).toMatch(/^\d{6}$/);
    expect(s.alerts).toHaveLength(1);
    expect(s.activity.length).toBeGreaterThan(0);
    expect(JSON.stringify(s)).not.toMatch(/coffee|sister|alex@/);
    expect((await app.inject({ method: "GET", url: "/v1/screen/state", remoteAddress: "192.168.0.5" })).statusCode).toBe(404);
    services.alerts.raise("ledger", "urgent", "The ledger does not verify", "");
    expect((await app.inject({ method: "GET", url: "/v1/screen/state", remoteAddress: "127.0.0.1" })).json<{ state: string }>().state).toBe("attention");
    services.alerts.clear("ledger");
    services.alerts.clear("disk");
  });

  it("metrics count by route pattern and status class, never by path", async () => {
    await app.inject({ method: "GET", url: "/v1/memory", headers: { cookie: owner } });
    const res = await app.inject({ method: "GET", url: "/v1/system/metrics", headers: { cookie: owner } });
    expect(res.statusCode).toBe(200);
    const m = res.json<{ requests: { key: string; count: number }[] }>();
    const mem = m.requests.find((r) => r.key === "GET /v1/memory 2xx");
    expect(mem?.count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(m)).not.toMatch(/alex|example\.com|[0-9A-HJKMNP-TV-Z]{26}/);
    expect((await app.inject({ method: "GET", url: "/v1/system/alerts", headers: { cookie: maya } })).json()).toEqual({ alerts: [] });
  });
});
