import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { createVerifier } from "../src/auth.ts";
import { startSiteApi } from "../src/index.ts";
import { SupabaseStore } from "../src/store.ts";

/**
 * The Supabase store speaks PostgREST over the injected fetcher, so these
 * tests see exactly what the service would send and answer as the database
 * would, without a network. The verifier is fed a key pair made here.
 */
describe("the Supabase store", () => {
  it("inserts the right row for each kind, with the account attached, and lists them back in the old shape", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    // The store always sends a JSON string; reading it back typed keeps the assertions honest.
    const bodyOf = (c: { init: RequestInit }) => JSON.parse(c.init.body as string) as Record<string, unknown>;
    const rows: Record<string, Record<string, unknown>[]> = { reservations: [], applications: [], contact_messages: [], core_pings: [] };
    const fetcher: typeof fetch = async (url, init) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (u.includes("api.resend.com")) return new Response("{}", { status: 200 });
      calls.push({ url: u, init: init ?? {} });
      const table = new URL(u).pathname.split("/").pop()!;
      if (init?.method === "POST") {
        const row = { id: `id-${rows[table]!.length + 1}`, created_at: "2026-09-12T00:00:00Z", user_id: null, ...(JSON.parse(init.body as string) as Record<string, unknown>) };
        rows[table]!.push(row);
        return new Response(JSON.stringify([row]), { status: 201 });
      }
      return new Response(JSON.stringify(rows[table]), { status: 200 });
    };
    const api = await startSiteApi({
      port: 0,
      store: new SupabaseStore({ url: "https://sb.test", secretKey: "service-key", fetcher }),
      verifyUser: async (h) => (h === "Bearer good" ? "user-1" : null),
      adminToken: "admin",
      resendKey: "rk",
      fetcher,
    });
    const post = (path: string, body: unknown, auth?: string) =>
      fetch(`${api.url}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });

    expect((await post("/reservations", { code: "WV-1", tier: "core", total: 899, email: "a@example.com", name: "A", finish: "graphite" }, "Bearer good")).status).toBe(201);
    expect((await post("/reservations", { code: "WV-2", tier: "core+", total: 1499 })).status).toBe(201);
    expect((await post("/contact", { email: "b@example.com", message: "hi" }, "Bearer nope")).status).toBe(201);
    expect((await post("/ping", { version: "1.0.0", kind: "mac", upDays: 2 }, "Bearer good")).status).toBe(201);

    const posted = calls.filter((c) => c.init.method === "POST");
    expect(posted.map((c) => new URL(c.url).pathname)).toEqual(["/rest/v1/reservations", "/rest/v1/reservations", "/rest/v1/contact_messages", "/rest/v1/core_pings"]);
    const h = posted[0]!.init.headers as Record<string, string>;
    expect(h.apikey).toBe("service-key");
    expect(h.authorization).toBe("Bearer service-key");
    expect(h.prefer).toBe("return=representation");
    expect(bodyOf(posted[0]!)).toEqual({ code: "WV-1", tier: "core", total: 899, email: "a@example.com", name: "A", user_id: "user-1", details: { code: "WV-1", tier: "core", total: 899, email: "a@example.com", name: "A", finish: "graphite" } });
    expect(bodyOf(posted[1]!).user_id).toBeNull();
    expect(bodyOf(posted[2]!)).toEqual({ email: "b@example.com", message: "hi", user_id: null });
    // A ping never carries an account, even when one was offered.
    expect(bodyOf(posted[3]!)).toEqual({ version: "1.0.0", kind: "mac", up_days: 2 });

    const list = await fetch(`${api.url}/admin/reservations`, { headers: { authorization: "Bearer admin" } });
    const items = ((await list.json()) as { items: { id: string; kind: string; at: string; body: { code: string }; userId: string | null }[] }).items;
    expect(items.map((i) => [i.kind, i.body.code, i.userId])).toEqual([
      ["reservations", "WV-1", "user-1"],
      ["reservations", "WV-2", null],
    ]);
    const pings = await fetch(`${api.url}/admin/pings`, { headers: { authorization: "Bearer admin" } });
    expect(((await pings.json()) as { items: { body: unknown }[] }).items[0]?.body).toEqual({ version: "1.0.0", kind: "mac", upDays: 2 });
    await api.close();
  });

  it("turns a database refusal into a 500 rather than a quiet 201", async () => {
    const fetcher: typeof fetch = async () => new Response('{"message":"permission denied"}', { status: 401 });
    const api = await startSiteApi({ port: 0, store: new SupabaseStore({ url: "https://sb.test", secretKey: "k", fetcher }), fetcher });
    const r = await fetch(`${api.url}/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@example.com", message: "m" }) });
    expect(r.status).toBe(500);
    await api.close();
  });
});

describe("the account verifier", () => {
  it("accepts a token signed by the project's key and nothing else", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" };
    const other = await generateKeyPair("ES256");
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
    const verify = createVerifier({ url: "https://sb.test/", fetcher });
    type Key = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
    const mint = (key: Key, claims: Record<string, unknown>) =>
      new SignJWT({ ...claims }).setProtectedHeader({ alg: "ES256", kid: "k1" }).setIssuedAt().setExpirationTime("5m").sign(key);

    const good = await mint(privateKey, { sub: "user-42", iss: "https://sb.test/auth/v1", aud: "authenticated", email: "a@example.com" });
    expect(await verify(`Bearer ${good}`)).toBe("user-42");
    expect(await verify(`bearer ${good}`)).toBe("user-42");
    expect(await verify(undefined)).toBeNull();
    expect(await verify("Bearer not-a-token")).toBeNull();
    expect(await verify(`Bearer ${await mint(other.privateKey, { sub: "u", iss: "https://sb.test/auth/v1", aud: "authenticated" })}`)).toBeNull();
    expect(await verify(`Bearer ${await mint(privateKey, { sub: "u", iss: "https://elsewhere/auth/v1", aud: "authenticated" })}`)).toBeNull();
    expect(await verify(`Bearer ${await mint(privateKey, { sub: "u", iss: "https://sb.test/auth/v1", aud: "anon" })}`)).toBeNull();
  });
});
