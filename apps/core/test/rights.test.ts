import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
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
import { auth, sessionOf, type Auth } from "./helpers.ts";
import { ScreenCode } from "../src/auth/screen.ts";
import { blobs, files, people } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-rights-`);
const ORIGIN = "http://localhost:3000";
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: ORIGIN, WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let ownerId = "";
let householdId = "";


beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"));
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const body = setup.json<{ recoveryCodes: string[]; household: { id: string }; owner: { id: string } }>();
  householdId = body.household.id;
  ownerId = body.owner.id;
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: body.recoveryCodes[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("the code on the screen (phase 9)", () => {
  it("rotates every minute, accepts the previous minute, locks after five misses", () => {
    let t = 1_000_000_000_000;
    const screen = new ScreenCode(60_000, () => t);
    const a = screen.current();
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.secondsLeft).toBeGreaterThan(0);
    expect(screen.verify(a.code)).toBe(true);
    t += 61_000;
    const b = screen.current().code;
    expect(b).not.toBe(a.code);
    expect(screen.verify(a.code)).toBe(true); // previous minute still fine
    t += 61_000;
    expect(screen.verify(a.code)).toBe(false); // two minutes old
    for (let i = 0; i < 5; i += 1) screen.verify("000000");
    expect(screen.verify(screen.current().code)).toBe(false); // locked this minute
    expect(screen.verify(b)).toBe(false);
  });

  it("serves the screen only to the machine's own display", async () => {
    const local = await app.inject({ method: "GET", url: "/v1/screen", remoteAddress: "127.0.0.1" });
    expect(local.statusCode).toBe(200);
    expect(local.body).toContain("Sign in with your name");
    const lan = await app.inject({ method: "GET", url: "/v1/screen", remoteAddress: "192.168.0.44" });
    expect(lan.statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/screen/code", remoteAddress: "192.168.0.44" })).statusCode).toBe(404);
  });

  it("signs a device in by name and code, for people who exist", async () => {
    const { code } = services.screen.current();
    const nobody = await app.inject({ method: "POST", url: "/v1/auth/code/login", payload: { name: "Zed", code } });
    expect(nobody.statusCode).toBe(401);
    const wrong = await app.inject({ method: "POST", url: "/v1/auth/code/login", payload: { name: "alex", code: "000000" } });
    expect(wrong.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/v1/auth/code/login", payload: { name: "alex", code } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ method: string; person: { name: string } }>()).toMatchObject({ method: "code", person: { name: "Alex" } });
    expect(sessionOf(ok).cookie).toMatch(/^woven_session=/);
  });
});

describe("invitations (phase 10)", () => {
  let token = "";
  let guestId = "";

  it("an adult is invited with a link that works once", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/household/invitations", headers: auth(owner), payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
    expect(res.statusCode).toBe(201);
    const inv = res.json<{ token: string; person: { role: string; name: string } }>();
    expect(inv.person).toMatchObject({ name: "Maya", role: "adult" });
    token = inv.token;
    const pending = await app.inject({ method: "GET", url: "/v1/household/invitations", headers: auth(owner) });
    expect(pending.json<{ invitations: { token?: string }[] }>().invitations).toHaveLength(1);
    expect(pending.json<{ invitations: { token?: string }[] }>().invitations[0]?.token).toBeUndefined();

    const accept = await app.inject({ method: "POST", url: "/v1/household/invitations/accept", payload: { token } });
    expect(accept.statusCode).toBe(200);
    const { enrolment } = accept.json<{ enrolment: string; person: { name: string } }>();
    const options = await app.inject({ method: "POST", url: "/v1/auth/passkeys/register/options", headers: { origin: ORIGIN }, payload: { enrolment } });
    expect(options.statusCode).toBe(200);
    expect(options.json<{ options: { user: { name: string } } }>().options.user.name).toBe("maya@example.com");
    expect((await app.inject({ method: "POST", url: "/v1/household/invitations/accept", payload: { token } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/household/invitations", headers: auth(owner) })).json<{ invitations: unknown[] }>().invitations).toHaveLength(0);
  });

  it("a guest needs a stay length and stops working when it ends", async () => {
    const noDays = await app.inject({ method: "POST", url: "/v1/household/invitations", headers: auth(owner), payload: { name: "Pat", role: "guest" } });
    expect(noDays.statusCode).toBe(400);
    const res = await app.inject({ method: "POST", url: "/v1/household/invitations", headers: auth(owner), payload: { name: "Pat", role: "guest", guestDays: 3 } });
    const inv = res.json<{ person: { id: string; expiresAt: string | null } }>();
    guestId = inv.person.id;
    expect(inv.person.expiresAt).not.toBeNull();
    const pat = services.household.person(guestId)!;
    const code = services.recovery.issue(pat)[0]!;
    const cookie = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "pat@example.com", code } }).then((r) => (r.statusCode === 200 ? r : { headers: {} as Record<string, unknown> })));
    // Guests without an email sign in by the screen code.
    const { code: screen } = services.screen.current();
    const session = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/code/login", payload: { name: "Pat", code: screen } }));
    expect((session.cookie || cookie.cookie)).toMatch(/woven_session=/);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(session) })).statusCode).toBe(200);
    data.database.db.update(people).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(people.id, guestId)).run();
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(session) })).statusCode).toBe(401);
  });

  it("withdrawing an invitation removes the pending person", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/household/invitations", headers: auth(owner), payload: { name: "Temp", role: "child" } });
    const id = res.json<{ id: string }>().id;
    expect((await app.inject({ method: "DELETE", url: `/v1/household/invitations/${id}`, headers: auth(owner) })).json()).toEqual({ withdrawn: true });
    expect(services.household.people(householdId).map((p) => p.name)).not.toContain("Temp");
  });
});

describe("data rights (phase 11)", () => {
  it("exports a person's data as a folder with a manifest and their objects", async () => {
    const blob = await data.store.put(Buffer.from("a photo of the garden"));
    const now = new Date().toISOString();
    data.database.db.insert(blobs).values({ sha256: blob.sha256, size: blob.size, mime: "image/jpeg", createdAt: now }).run();
    data.database.db.insert(files).values({ id: "01J9Z0F00000000000000000001", householdId, ownerId, namespace: "personal", path: "/photos", name: "garden.jpg", sha256: blob.sha256, size: blob.size, mime: "image/jpeg", createdAt: now, modifiedAt: now }).run();
    const res = await app.inject({ method: "POST", url: "/v1/household/export", headers: auth(owner), payload: { scope: "me" } });
    expect(res.statusCode).toBe(200);
    const { dir, counts } = res.json<{ dir: string; counts: Record<string, number> }>();
    expect(counts).toMatchObject({ people: 1, files: 1, objects: 1 });
    expect(JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"))).toMatchObject({ scope: "me", counts });
    expect((await readFile(join(dir, "objects", `${blob.sha256}.jpg`))).toString()).toBe("a photo of the garden");
    const receipts = JSON.parse(await readFile(join(dir, "receipts.json"), "utf8")) as unknown[];
    expect(receipts.length).toBeGreaterThan(0);
  });

  it("deletes an account: no sessions, no keys, no files, no objects, and a ledger row that it happened", async () => {
    const maya = services.household.personByEmail("maya@example.com")!;
    const code = services.recovery.issue(maya)[0]!;
    const cookie = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code } }));
    const blob = await data.store.put(Buffer.from("maya's notes"));
    const now = new Date().toISOString();
    data.database.db.insert(blobs).values({ sha256: blob.sha256, size: blob.size, mime: "text/plain", createdAt: now }).run();
    data.database.db.insert(files).values({ id: "01J9Z0F00000000000000000002", householdId, ownerId: maya.id, namespace: "personal", path: "/", name: "notes.txt", sha256: blob.sha256, size: blob.size, mime: "text/plain", createdAt: now, modifiedAt: now }).run();

    const asSelfOnOwner = await app.inject({ method: "DELETE", url: `/v1/household/people/${ownerId}/account`, headers: auth(cookie) });
    expect(asSelfOnOwner.statusCode).toBe(400);
    const res = await app.inject({ method: "DELETE", url: `/v1/household/people/${maya.id}/account`, headers: auth(cookie) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ files: 1, objects: 1 });
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(cookie) })).statusCode).toBe(401);
    expect(await data.store.has(blob.sha256)).toBe(false);
    expect(services.household.personByEmail("maya@example.com")).toBeNull();
    expect(services.household.person(maya.id)).toMatchObject({ removedAt: expect.any(String), email: null });
    expect(data.ledger.recent(householdId, 3).some((r) => r.type === "person.removed" && r.payload.reason === "account deleted")).toBe(true);
    expect(data.ledger.verify().ok).toBe(true);
  });

  it("transfers ownership only through the class H action with a passkey, and the roles swap", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Jo", email: "jo@example.com", role: "adult" } });
    const jo = res.json<{ id: string }>().id;
    const prepared = await app.inject({ method: "POST", url: "/v1/actions/prepare", headers: auth(owner), payload: { capability: "household.transfer_ownership", target: "household", parameters: { toPersonId: jo } } });
    expect(prepared.json<{ status: string; approval: { factors: string[] } }>()).toMatchObject({ status: "prepared", approval: { factors: ["strong_auth"] } });
    const noKey = await app.inject({ method: "POST", url: `/v1/actions/${prepared.json<{ id: string }>().id}/execute`, headers: auth(owner) });
    expect(noKey.statusCode).toBe(409);
    // The service itself, as the executor would call it after the passkey check.
    const swapped = services.rights.transferOwnership(services.household.person(ownerId)!, jo);
    expect(swapped.from.role).toBe("adult");
    expect(swapped.to.role).toBe("owner");
    expect(() => services.rights.transferOwnership(services.household.person(ownerId)!, jo)).toThrow(/Only the owner/);
  });
});
