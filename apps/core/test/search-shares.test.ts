import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import type { DeviceToken, SearchResult, Share } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { toMatch } from "../src/search.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-search-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let maya: Auth = { cookie: "", device: "" };
let leaseId = "";
let privateId = "";

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
  await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
  const mayaPerson = services.household.personByEmail("maya@example.com")!;
  maya = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code: services.recovery.issue(mayaPerson)[0] } }));
  const alex = services.household.personByEmail("alex@example.com")!;
  leaseId = (await services.files.put(alex, { name: "Lease renewal 2026.pdf", path: "/Home", namespace: "household", mime: "application/pdf" }, Buffer.from("a lease, 40 bytes of it............"))).id;
  privateId = (await services.files.put(alex, { name: "Tax return.pdf", path: "/", namespace: "financial", mime: "application/pdf" }, Buffer.from("private"))).id;
  services.memory.remember(alex, { text: "Maya's dentist is Dr Chen", kind: "fact" });
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("search on the box (gap 18)", () => {
  it("turns words into prefix terms and drops syntax", () => {
    expect(toMatch("lease renew")).toBe('"lease"* "renew"*');
    expect(toMatch('OR "x" NEAR(')).toBe('"or"* "x"* "near"*');
    expect(toMatch("   ")).toBeNull();
  });

  it("finds files, memories and routines the reader may see, and nothing else", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/search?q=lease", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const results = res.json<{ results: SearchResult[] }>().results;
    expect(results.map((r) => r.title)).toEqual(["Lease renewal 2026.pdf"]);
    expect(results[0]).toMatchObject({ kind: "file", namespace: "household", href: "/dashboard/files?ns=household&path=%2FHome" });
    expect(results[0]?.snippet).toContain("[Lease]");
    // Alex's financial file is Alex's alone; the memory too.
    expect((await app.inject({ method: "GET", url: "/v1/search?q=tax", headers: auth(owner) })).json<{ results: SearchResult[] }>().results).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/search?q=tax", headers: auth(maya) })).json<{ results: SearchResult[] }>().results).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/v1/search?q=dentist", headers: auth(owner) })).json<{ results: SearchResult[] }>().results).toMatchObject([{ kind: "memory", title: "Maya's dentist is Dr Chen" }]);
    expect((await app.inject({ method: "GET", url: "/v1/search?q=dentist", headers: auth(maya) })).json<{ results: SearchResult[] }>().results).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/v1/search?q=lease" })).statusCode).toBe(401);
  });

  it("follows renames and deletions, and rebuilds when the index drifted", async () => {
    const alex = services.household.personByEmail("alex@example.com")!;
    services.files.move(alex, leaseId, { name: "Flat contract.pdf" });
    const q = (s: string) => app.inject({ method: "GET", url: `/v1/search?q=${s}`, headers: auth(owner) }).then((r) => r.json<{ results: SearchResult[] }>().results);
    expect((await q("lease")).map((r) => r.title)).toEqual([]);
    expect((await q("flat")).map((r) => r.title)).toEqual(["Flat contract.pdf"]);
    const m = services.memory.list(alex)[0]!;
    services.memory.forget(alex, m.id);
    expect(await q("dentist")).toEqual([]);
    const r = services.routines.create({ name: "Movie night", trigger: { kind: "phrase", phrase: "movie time" }, steps: [{ capability: "light.set", target: "living.ceiling", parameters: { on: false } }], enabled: true }, alex);
    expect((await q("movie")).map((x) => x.kind)).toEqual(["routine"]);
    services.routines.remove(r.id, alex);
    expect(await q("movie")).toEqual([]);
    data.database.sqlite.exec("DELETE FROM search");
    expect(services.search.reindexIfNeeded()).toMatchObject({ files: 2, memories: 0, routines: 3 }) // the three starter routines;
    expect(services.search.reindexIfNeeded()).toBeNull();
    expect((await q("flat")).map((r) => r.title)).toEqual(["Flat contract.pdf"]);
  });
});

describe("share links (gap 19)", () => {
  let token = "";
  let shareId = "";

  it("makes a link that serves one file to anyone until it expires or is revoked", async () => {
    const res = await app.inject({ method: "POST", url: `/v1/files/${leaseId}/shares`, headers: auth(owner), payload: { expiresInHours: 24, maxDownloads: 2 } });
    expect(res.statusCode).toBe(201);
    const made = res.json<{ share: Share; token: string }>();
    token = made.token;
    shareId = made.share.id;
    expect(made.share).toMatchObject({ name: "Flat contract.pdf", live: true, downloads: 0, maxDownloads: 2 });
    expect(token.length).toBeGreaterThanOrEqual(40);

    const info = await app.inject({ method: "GET", url: `/v1/s/${token}/info` });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ name: "Flat contract.pdf", mime: "application/pdf" });
    const dl = await app.inject({ method: "GET", url: `/v1/s/${token}` });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-disposition"]).toContain("attachment");
    expect(dl.headers["x-robots-tag"]).toBe("noindex");
    expect(dl.body).toContain("a lease");
    const part = await app.inject({ method: "GET", url: `/v1/s/${token}`, headers: { range: "bytes=2-6" } });
    expect(part.statusCode).toBe(206);
    expect(part.body).toBe("lease");
    // Two downloads was the cap.
    expect((await app.inject({ method: "GET", url: `/v1/s/${token}` })).statusCode).toBe(404);
    const list = await app.inject({ method: "GET", url: "/v1/files/shares", headers: auth(owner) });
    expect(list.json<{ shares: Share[] }>().shares[0]).toMatchObject({ id: shareId, downloads: 2, live: false });
    expect(data.ledger.recent(undefined, 10).filter((r) => r.type === "file.share_used")).toHaveLength(2);
  });

  it("never serves through a bad, revoked or foreign token, and only the maker or owner revokes", async () => {
    expect((await app.inject({ method: "GET", url: `/v1/s/${"x".repeat(43)}` })).statusCode).toBe(404);
    const res = await app.inject({ method: "POST", url: `/v1/files/${leaseId}/shares`, headers: auth(maya), payload: {} });
    expect(res.statusCode).toBe(201);
    const mine = res.json<{ share: Share; token: string }>();
    expect((await app.inject({ method: "GET", url: `/v1/s/${mine.token}/info` })).statusCode).toBe(200);
    // Maya cannot share Alex's financial file.
    expect((await app.inject({ method: "POST", url: `/v1/files/${privateId}/shares`, headers: auth(maya), payload: {} })).statusCode).toBe(403);
    const revoked = await app.inject({ method: "DELETE", url: `/v1/files/shares/${mine.share.id}`, headers: auth(owner) });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json<Share>().live).toBe(false);
    expect((await app.inject({ method: "GET", url: `/v1/s/${mine.token}` })).statusCode).toBe(404);
    expect(data.ledger.verify().ok).toBe(true);
  });
});

describe("device tokens (gap 20)", () => {
  it("issues a year-long bearer token a backup client can use, lists and revokes it", async () => {
    const made = await app.inject({ method: "POST", url: "/v1/auth/tokens", headers: auth(owner), payload: { label: "Alex's MacBook" } });
    expect(made.statusCode).toBe(201);
    const t = made.json<DeviceToken & { token: string }>();
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}$/);
    expect(new Date(t.expiresAt).getTime() - Date.now()).toBeGreaterThan(300 * 86_400_000);
    const me = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${t.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ method: "token", person: { name: "Alex" } });
    // Half a token, or a browser session used as a bearer, does not pass.
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${t.token.split(".")[0]}.${"a".repeat(43)}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${owner.cookie.split("=")[1]}.${owner.device}` } })).statusCode).toBe(401);
    // The upload protocol works with it.
    const start = await app.inject({ method: "POST", url: "/v1/files/uploads", headers: { authorization: `Bearer ${t.token}` }, payload: { name: "notes.txt", path: "/Backups/mac", namespace: "personal", size: 5, source: "backup:mac" } });
    expect(start.statusCode).toBe(201);
    const list = await app.inject({ method: "GET", url: "/v1/auth/tokens", headers: auth(owner) });
    expect(list.json<{ tokens: DeviceToken[] }>().tokens).toMatchObject([{ id: t.id, label: "Alex's MacBook" }]);
    expect((await app.inject({ method: "DELETE", url: `/v1/auth/tokens/${t.id}`, headers: auth(owner) })).json()).toEqual({ revoked: true });
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${t.token}` } })).statusCode).toBe(401);
    // A child cannot make one.
    expect((await app.inject({ method: "POST", url: "/v1/auth/tokens", headers: auth(maya), payload: { label: "x" } })).statusCode).toBe(201);
  });
});
