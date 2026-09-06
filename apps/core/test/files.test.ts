import { mkdtempSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";
import { CHUNK_SIZE, normalizePath, sha256File, walkFiles } from "../src/files.ts";
import { createHash } from "node:crypto";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-files-`);
const ORIGIN = "http://localhost:3000";
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: ORIGIN, WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let child: Auth = { cookie: "", device: "" };
type Entry = { id: string; name: string; path: string; namespace: string; sha256: string; size: number };
type Listing = { folders: { name: string; items: number }[]; files: Entry[] };

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"));
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const body = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: body.recoveryCodes[0] } }));
  await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Sam", email: "sam@example.com", role: "child" } });
  const sam = services.household.personByEmail("sam@example.com")!;
  child = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "sam@example.com", code: services.recovery.issue(sam)[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("paths", () => {
  it("normalises folders", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("a//../b")).toBe("/a/b");
  });
});

describe("uploads (phase 18)", () => {
  it("uploads in chunks, resumes, verifies the hash, and dedups", async () => {
    const bytes = Buffer.alloc(CHUNK_SIZE + 1234, 7);
    for (let i = 0; i < bytes.length; i += 4096) bytes[i] = i & 0xff;
    const start = await app.inject({ method: "POST", url: "/v1/files/uploads", headers: auth(owner), payload: { name: "big.bin", path: "/Backups/laptop", size: bytes.length, sha256: sha(bytes), mime: "application/octet-stream" } });
    expect(start.statusCode).toBe(201);
    const session = start.json<{ id: string; chunks: number; alreadyStored: boolean }>();
    expect(session.chunks).toBe(2);
    expect(session.alreadyStored).toBe(false);

    const wrongSize = await app.inject({ method: "PUT", url: `/v1/files/uploads/${session.id}/chunks/0`, headers: { ...auth(owner), "content-type": "application/octet-stream" }, payload: bytes.subarray(0, 100) });
    expect(wrongSize.statusCode).toBe(400);
    const c1 = await app.inject({ method: "PUT", url: `/v1/files/uploads/${session.id}/chunks/1`, headers: { ...auth(owner), "content-type": "application/octet-stream" }, payload: bytes.subarray(CHUNK_SIZE) });
    expect(c1.json<{ received: number[] }>().received).toEqual([1]);
    const early = await app.inject({ method: "POST", url: `/v1/files/uploads/${session.id}/complete`, headers: auth(owner) });
    expect(early.statusCode).toBe(409);
    // A "new device" asks where it got to, then sends what is missing.
    const status = await app.inject({ method: "GET", url: `/v1/files/uploads/${session.id}`, headers: auth(owner) });
    expect(status.json<{ received: number[] }>().received).toEqual([1]);
    await app.inject({ method: "PUT", url: `/v1/files/uploads/${session.id}/chunks/0`, headers: { ...auth(owner), "content-type": "application/octet-stream" }, payload: bytes.subarray(0, CHUNK_SIZE) });
    const done = await app.inject({ method: "POST", url: `/v1/files/uploads/${session.id}/complete`, headers: auth(owner) });
    expect(done.statusCode).toBe(201);
    const entry = done.json<Entry>();
    expect(entry).toMatchObject({ name: "big.bin", path: "/Backups/laptop", sha256: sha(bytes), size: bytes.length, namespace: "personal" });
    expect(await data.store.verify(entry.sha256)).toBe(true);

    // The same bytes from another device: the box already has them, no chunks travel.
    const again = await app.inject({ method: "POST", url: "/v1/files/uploads", headers: auth(owner), payload: { name: "copy.bin", path: "/Backups/desktop", size: bytes.length, sha256: sha(bytes) } });
    expect(again.json<{ alreadyStored: boolean }>().alreadyStored).toBe(true);
    const copy = await app.inject({ method: "POST", url: `/v1/files/uploads/${again.json<{ id: string }>().id}/complete`, headers: auth(owner) });
    expect(copy.statusCode).toBe(201);
    expect(copy.json<Entry>().sha256).toBe(entry.sha256);
    const summary = await app.inject({ method: "GET", url: "/v1/files/summary", headers: auth(owner) });
    const sum = summary.json<{ totalBytes: number; uniqueBytes: number; sources: { source: string }[] }>();
    expect(sum.totalBytes).toBe(bytes.length * 2);
    expect(sum.uniqueBytes).toBe(bytes.length);
    expect(sum.sources[0]?.source).toBe("dashboard");

    const lied = await app.inject({ method: "POST", url: "/v1/files/uploads", headers: auth(owner), payload: { name: "liar.bin", path: "/", size: 5, sha256: "a".repeat(64) } });
    await app.inject({ method: "PUT", url: `/v1/files/uploads/${lied.json<{ id: string }>().id}/chunks/0`, headers: { ...auth(owner), "content-type": "application/octet-stream" }, payload: Buffer.from("hello") });
    const bad = await app.inject({ method: "POST", url: `/v1/files/uploads/${lied.json<{ id: string }>().id}/complete`, headers: auth(owner) });
    expect(bad.statusCode).toBe(400);
    expect(await data.store.has(sha(Buffer.from("hello")))).toBe(false);
  });
});

describe("files (phase 19)", () => {
  it("lists folders derived from paths, downloads, moves, shares, and keeps namespaces apart", async () => {
    const alex = services.household.personByEmail("alex@example.com")!;
    const sam = services.household.personByEmail("sam@example.com")!;
    await services.files.put(alex, { name: "lease.pdf", path: "/Documents/Home", namespace: "personal", mime: "application/pdf" }, Buffer.from("%PDF lease"));
    await services.files.put(alex, { name: "notes.txt", path: "/Documents", namespace: "personal", mime: "text/plain" }, Buffer.from("notes"));
    await services.files.put(sam, { name: "essay.txt", path: "/School", namespace: "personal", mime: "text/plain" }, Buffer.from("my essay"));
    const shared = await services.files.put(alex, { name: "wifi.txt", path: "/", namespace: "household", mime: "text/plain" }, Buffer.from("password: none"));

    const root = await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/", headers: auth(owner) });
    const listing = root.json<Listing>();
    expect(listing.folders.map((f) => f.name)).toEqual(["Backups", "Documents"]);
    expect(listing.folders.find((f) => f.name === "Documents")?.items).toBe(2);
    const docs = await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/Documents", headers: auth(owner) });
    expect(docs.json<Listing>().files.map((f) => f.name)).toEqual(["notes.txt"]);
    expect(docs.json<Listing>().folders.map((f) => f.name)).toEqual(["Home"]);

    // The owner's personal listing does not contain Sam's essay, and Sam cannot open the lease.
    expect(JSON.stringify(listing)).not.toContain("essay");
    const lease = docs.json<Listing>().folders.length ? (await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/Documents/Home", headers: auth(owner) })).json<Listing>().files[0]! : null;
    expect((await app.inject({ method: "GET", url: `/v1/files/${lease!.id}/content`, headers: auth(child) })).statusCode).toBe(403);
    const dl = await app.inject({ method: "GET", url: `/v1/files/${lease!.id}/content?download=true`, headers: auth(owner) });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toBe("application/pdf");
    expect(dl.headers["content-disposition"]).toMatch(/attachment/);
    expect(dl.body).toBe("%PDF lease");

    // Everyone sees the household namespace; a child cannot browse security.
    const samShared = await app.inject({ method: "GET", url: "/v1/files?namespace=household", headers: auth(child) });
    expect(samShared.json<Listing>().files.map((f) => f.name)).toEqual(["wifi.txt"]);
    expect((await app.inject({ method: "GET", url: "/v1/files?namespace=security", headers: auth(child) })).statusCode).toBe(403);

    // Sharing = moving into the household namespace; it leaves a receipt. A child cannot move Alex's file.
    expect((await app.inject({ method: "POST", url: `/v1/files/${lease!.id}/move`, headers: auth(child), payload: { namespace: "household" } })).statusCode).toBe(403);
    const moved = await app.inject({ method: "POST", url: `/v1/files/${lease!.id}/move`, headers: auth(owner), payload: { namespace: "household", path: "/Home", name: "lease-2026.pdf" } });
    expect(moved.json<Entry>()).toMatchObject({ namespace: "household", path: "/Home", name: "lease-2026.pdf" });
    expect(data.ledger.recent(alex.householdId, 1)[0]?.payload).toMatchObject({ capability: "file.share" });
    expect((await app.inject({ method: "GET", url: `/v1/files/${lease!.id}/content`, headers: auth(child) })).statusCode).toBe(200);

    // Deleting the last reference removes the object; a shared hash survives while another file points at it.
    const dup = await services.files.put(alex, { name: "wifi-copy.txt", path: "/Copies", namespace: "personal" }, Buffer.from("password: none"));
    expect(dup.sha256).toBe(shared.sha256);
    expect((await app.inject({ method: "DELETE", url: `/v1/files/${shared.id}`, headers: auth(owner) })).statusCode).toBe(200);
    expect(await data.store.has(shared.sha256)).toBe(true);
    await app.inject({ method: "DELETE", url: `/v1/files/${dup.id}`, headers: auth(owner) });
    expect(await data.store.has(shared.sha256)).toBe(false);
  });

  it("the backup walk hashes files and skips sidecars and hidden folders", async () => {
    const dir = join(dataRoot, "walk");
    await mkdir(join(dir, "sub", ".git"), { recursive: true });
    await writeFile(join(dir, "a.txt"), "aaa");
    await writeFile(join(dir, "._a.txt"), "sidecar");
    await writeFile(join(dir, "sub", "b.txt"), "bbb");
    await writeFile(join(dir, "sub", ".git", "c"), "ccc");
    const seen: string[] = [];
    for await (const f of walkFiles(dir)) seen.push(f.slice(dir.length));
    expect(seen.sort()).toEqual(["/a.txt", "/sub/b.txt"]);
    expect(await sha256File(join(dir, "a.txt"))).toBe(sha(Buffer.from("aaa")));
    // Re-adding the same bytes at the same place is a no-op; new bytes replace the row.
    const alex = services.household.personByEmail("alex@example.com")!;
    const first = services.files.add(alex, { name: "a.txt", path: "/Backups/mac/walk", namespace: "personal", sha256: sha(Buffer.from("aaa")), size: 3, source: "backup:mac" });
    const same = services.files.add(alex, { name: "a.txt", path: "/Backups/mac/walk", namespace: "personal", sha256: sha(Buffer.from("aaa")), size: 3, source: "backup:mac" });
    expect(same.id).toBe(first.id);
    const changed = services.files.add(alex, { name: "a.txt", path: "/Backups/mac/walk", namespace: "personal", sha256: sha(Buffer.from("aaaa")), size: 4, source: "backup:mac" });
    expect(changed.id).not.toBe(first.id);
    const listing = (await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/Backups/mac/walk", headers: auth(owner) })).json<Listing>();
    expect(listing.files).toHaveLength(1);
    expect(listing.files[0]?.size).toBe(4);
  });
});
