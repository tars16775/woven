import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import type { AskAnswer, PilotNumbers, PrivacySummary } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-ask-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
  const alex = services.household.personByEmail("alex@example.com")!;
  await services.files.put(alex, { name: "Lease 2026.pdf", path: "/Home", namespace: "household", mime: "application/pdf" }, Buffer.from("not really a pdf"));
  await services.files.put(alex, { name: "notes.txt", path: "/", namespace: "personal" }, Buffer.from("notes"));
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

const ask = async (question: string) => {
  const res = await app.inject({ method: "POST", url: "/v1/ask", headers: auth(owner), payload: { question } });
  expect(res.statusCode).toBe(200);
  return res.json<AskAnswer>();
};

describe("Ask, rules on the box (gap 11)", () => {
  it("needs a session", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/ask", payload: { question: "hi" } })).statusCode).toBe(401);
  });

  it("finds files by name and says it only looks at names", async () => {
    const a = await ask("find the lease");
    expect(a.engine).toBe("rules");
    expect(a.where).toBe("local");
    expect(a.items.map((i) => i.title)).toEqual(["Lease 2026.pdf"]);
    expect(a.items[0]?.href).toContain("/dashboard/files");
    const none = await ask("is there a document called tax return?");
    expect(none.items).toEqual([]);
    expect(none.text).toMatch(/only look at file names/);
  });

  it("changes the house through the action engine and reads back", async () => {
    const a = await ask("turn the kitchen light off");
    expect(a.action).toMatchObject({ capability: "light.set", status: "succeeded", planned: { on: false } });
    expect(a.text).toMatch(/Main is off/);
    const which = await ask("turn the light on");
    expect(which.action).toBeNull();
    expect(which.text).toMatch(/Which one/);
    const locks = await ask("is the door locked?");
    expect(locks.text).toMatch(/locked|unlocked|No lock/);
  });

  it("remembers, counts photos, reports the box and admits what it cannot do", async () => {
    expect((await ask("remember the bins go out on Tuesday")).text).toMatch(/Remembered/);
    expect((await ask("what do you remember?")).items.map((i) => i.title)).toEqual(["the bins go out on Tuesday"]);
    expect((await ask("how many photos do I have?")).text).toMatch(/No photos on the box yet/);
    expect((await ask("how is the box?")).source).toBe("Core");
    const today = await ask("what happened today?");
    expect(today.source).toBe("Ledger");
    expect(today.text).toMatch(/receipts today/);
    const unknown = await ask("compare heat pumps for this house");
    expect(unknown.action).toBeNull();
    expect(unknown.text).toMatch(/no language model here yet/);
    expect(unknown.text).toMatch(/nothing crosses the Gate/);
  });
});

describe("privacy summary and pilot numbers (gaps 15 and 30)", () => {
  it("counts from the ledger only", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/privacy/summary", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const s = res.json<PrivacySummary>();
    expect(s.days).toBe(7);
    expect(s.events).toBeGreaterThan(5);
    expect(s.crossings).toBe(0);
    expect(s.inside).toBe(s.events);
    expect(s.insideShare).toBe(100);
    expect(s.bytesCrossedToday).toBe(0);
    expect(s.byType.find((t) => t.type === "action.executed")?.count).toBeGreaterThan(0);
    expect(s.byType.reduce((n, t) => n + t.count, 0)).toBe(s.events);
    // A crossing shows up with what it sent.
    data.ledger.append({ type: "gate.crossing", householdId: services.household.household()!.id, actor: { kind: "person", id: "p" }, where: "gate", sensitivity: "high", target: "api.example.com", sent: "the task text", payload: { capability: "gate.cross", observed: { bytesOut: 512 } } });
    const after = (await app.inject({ method: "GET", url: "/v1/privacy/summary", headers: auth(owner) })).json<PrivacySummary>();
    expect(after.crossings).toBe(1);
    expect(after.bytesCrossedToday).toBe(512);
    expect(after.crossings7d[0]).toMatchObject({ host: "api.example.com", sent: "the task text", bytesOut: 512, capability: "gate.cross" });
    expect(after.insideShare).toBeLessThan(100);
  });

  it("computes the pilot numbers now", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/pilot/numbers", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const n = res.json<PilotNumbers>();
    expect(n.people).toBe(1);
    expect(n.files.items).toBe(2);
    expect(n.photos).toBe(0);
    expect(n.ledgerRows).toBeGreaterThan(5);
    expect(n.crossings7d).toBe(1);
    expect(n.snapshots).toEqual({ count: 0, lastAt: null, mirrored: 0 });
    expect(n.gate).toBe("absent");
    expect(n.storage.totalBytes).toBeGreaterThan(0);
    expect((await app.inject({ method: "GET", url: "/v1/pilot/numbers" })).statusCode).toBe(401);
  });
});
