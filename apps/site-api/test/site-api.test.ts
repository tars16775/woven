import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSiteApi } from "../src/index.ts";

let api: Awaited<ReturnType<typeof startSiteApi>>;
const dir = mkdtempSync(`${os.tmpdir()}/woven-site-api-`);
const sent: { to: string; subject: string }[] = [];

beforeAll(async () => {
  api = await startSiteApi({
    port: 0,
    dataDir: dir,
    adminToken: "secret-admin",
    resendKey: "test-key",
    notify: "founders@example.com",
    fetcher: async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { to: string[]; subject: string };
      sent.push({ to: body.to[0]!, subject: body.subject });
      return new Response("{}", { status: 200 });
    },
  });
});

afterAll(async () => {
  await api.close();
  await rm(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) => fetch(`${api.url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the site API (gap 8)", () => {
  it("keeps reservations, mails the person and the founders, and lists them for an admin", async () => {
    const r = await post("/reservations", { code: "WV-1234", tier: "core", total: 1899, email: "alex@example.com", name: "Alex" });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ mail: "sent" });
    await new Promise((x) => setTimeout(x, 20));
    expect(sent.map((m) => m.to)).toEqual(["alex@example.com", "founders@example.com"]);
    expect((await post("/reservations", { code: "x" })).status).toBe(400);
    const nope = await fetch(`${api.url}/admin/reservations`);
    expect(nope.status).toBe(401);
    const list = await fetch(`${api.url}/admin/reservations`, { headers: { authorization: "Bearer secret-admin" } });
    expect(((await list.json()) as { items: { body: { code: string } }[] }).items.map((i) => i.body.code)).toEqual(["WV-1234"]);
  });

  it("takes applications, contact notes and health pings, and nothing else", async () => {
    expect((await post("/applications", { code: "FH-1", email: "m@example.com", city: "Berlin", people: "3" })).status).toBe(201);
    expect((await post("/contact", { email: "m@example.com", message: "hello" })).status).toBe(201);
    expect((await post("/ping", { version: "0.2.0", kind: "mac", upDays: 3 })).status).toBe(201);
    expect((await post("/ping", {})).status).toBe(400);
    expect((await post("/anything", {})).status).toBe(404);
    expect((await fetch(`${api.url}/health`)).status).toBe(200);
    const pings = await fetch(`${api.url}/admin/pings`, { headers: { authorization: "Bearer secret-admin" } });
    expect(((await pings.json()) as { items: { body: Record<string, unknown> }[] }).items[0]?.body).toEqual({ version: "0.2.0", kind: "mac", upDays: 3 });
  });

  it("refuses oversized and malformed bodies", async () => {
    expect((await fetch(`${api.url}/contact`, { method: "POST", body: "not json" })).status).toBe(400);
    expect((await fetch(`${api.url}/contact`, { method: "POST", body: "x".repeat(70_000) })).status).toBe(413);
  });
});
