import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";

/**
 * The public site's small backend (gap 8): reservations from the
 * configurator, founding-home applications, contact notes and the opt-in
 * health pings from Cores. It runs on Railway with a volume and keeps
 * append-only JSON lines; nothing here is household data. Email goes out
 * through Resend when a key is present, and is logged otherwise, so the
 * service is honest about what it did.
 */
export type SiteApiOptions = {
  port?: number;
  host?: string;
  dataDir: string;
  adminToken?: string | null;
  resendKey?: string | null;
  from?: string;
  notify?: string | null;
  fetcher?: typeof fetch;
  log?: (line: string) => void;
  /** CORS: the site's origin, and cores' dashboards for pings. */
  origins?: string[];
};

type Stored = { id: string; kind: string; at: string; body: Record<string, unknown> };

const MAX_BODY = 64 * 1024;

export async function startSiteApi(opts: SiteApiOptions) {
  await mkdir(opts.dataDir, { recursive: true });
  const log = opts.log ?? (() => undefined);
  const fetcher = opts.fetcher ?? fetch;
  const buckets = new Map<string, { n: number; at: number }>();

  const rateLimited = (ip: string, limit = 30): boolean => {
    const now = Date.now();
    const b = buckets.get(ip) ?? { n: 0, at: now };
    if (now - b.at > 60_000) {
      b.n = 0;
      b.at = now;
    }
    b.n += 1;
    buckets.set(ip, b);
    return b.n > limit;
  };

  const store = async (kind: string, body: Record<string, unknown>): Promise<Stored> => {
    const rec: Stored = { id: randomBytes(8).toString("hex"), kind, at: new Date().toISOString(), body };
    await appendFile(join(opts.dataDir, `${kind}.jsonl`), `${JSON.stringify(rec)}\n`);
    return rec;
  };

  const list = async (kind: string): Promise<Stored[]> => {
    try {
      return (await readFile(join(opts.dataDir, `${kind}.jsonl`), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Stored);
    } catch {
      return [];
    }
  };

  const email = async (to: string, subject: string, text: string): Promise<"sent" | "logged" | "failed"> => {
    if (!opts.resendKey) {
      log(`email (not sent, no key) to ${to}: ${subject}`);
      return "logged";
    }
    try {
      const res = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${opts.resendKey}`, "content-type": "application/json" }, body: JSON.stringify({ from: opts.from ?? "Woven <hello@woventechnology.com>", to: [to], subject, text }) });
      return res.ok ? "sent" : "failed";
    } catch {
      return "failed";
    }
  };

  const isAdmin = (req: http.IncomingMessage): boolean => {
    if (!opts.adminToken) return false;
    const got = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1] ?? "";
    const a = createHash("sha256").update(got).digest();
    const b = createHash("sha256").update(opts.adminToken).digest();
    return timingSafeEqual(a, b);
  };

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://site");
      const origin = String(req.headers.origin ?? "");
      if (opts.origins?.includes(origin)) {
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("access-control-allow-headers", "content-type");
        res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
      }
      res.setHeader("cache-control", "no-store");
      res.setHeader("content-type", "application/json");
      const json = (status: number, body: unknown) => {
        res.statusCode = status;
        res.end(JSON.stringify(body));
      };
      if (req.method === "OPTIONS") return json(204, null);
      const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0]!.trim();

      if (req.method === "GET" && url.pathname === "/health") return json(200, { ok: true, at: new Date().toISOString() });

      if (req.method === "GET" && url.pathname.startsWith("/admin/")) {
        if (!isAdmin(req)) return json(401, { error: "admin token" });
        const kind = url.pathname.slice("/admin/".length);
        if (!/^[a-z]+$/.test(kind)) return json(404, { error: "no such list" });
        return json(200, { items: await list(kind) });
      }

      if (req.method !== "POST") return json(404, { error: "not found" });
      if (rateLimited(ip)) return json(429, { error: "too many requests" });
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of req) {
        size += (c as Buffer).length;
        if (size > MAX_BODY) return json(413, { error: "too large" });
        chunks.push(c as Buffer);
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        return json(400, { error: "bad json" });
      }

      switch (url.pathname) {
        case "/reservations": {
          const { code, tier, total, email: to, name } = body;
          if (typeof code !== "string" || typeof tier !== "string" || typeof total !== "number") return json(400, { error: "code, tier and total are required" });
          const rec = await store("reservations", body);
          let mail: string = "none";
          if (typeof to === "string" && to.includes("@")) mail = await email(to, `Your Woven reservation ${code}`, `Thank you${typeof name === "string" ? `, ${name}` : ""}. Your reservation ${code} for the ${tier} is noted. Nothing is charged until we confirm a build slot with you. Reply to this email with any question.`);
          if (opts.notify) void email(opts.notify, `Reservation ${code}: ${tier}`, JSON.stringify(body, null, 2));
          log(`reservation ${code} (${tier}) mail=${mail}`);
          return json(201, { id: rec.id, at: rec.at, mail });
        }
        case "/applications": {
          const { code, email: to, city } = body;
          if (typeof code !== "string" || typeof to !== "string" || typeof city !== "string") return json(400, { error: "code, email and city are required" });
          const rec = await store("applications", body);
          const mail = await email(to, `Your founding home application ${code}`, `Thank you. We read every application ourselves and reply within two weeks. Your code is ${code}.`);
          if (opts.notify) void email(opts.notify, `Application ${code}: ${city}`, JSON.stringify(body, null, 2));
          log(`application ${code} (${city}) mail=${mail}`);
          return json(201, { id: rec.id, at: rec.at, mail });
        }
        case "/contact": {
          const { email: to, message } = body;
          if (typeof to !== "string" || typeof message !== "string" || !message.trim()) return json(400, { error: "email and message are required" });
          const rec = await store("contact", body);
          if (opts.notify) void email(opts.notify, `Contact from ${to}`, message);
          return json(201, { id: rec.id, at: rec.at });
        }
        case "/ping": {
          // From Cores that opted in: version, kind, uptime. No identifiers, and none are derived: the address is not kept.
          const { version, kind, upDays } = body;
          if (typeof version !== "string") return json(400, { error: "version is required" });
          const rec = await store("pings", { version, kind: typeof kind === "string" ? kind : "unknown", upDays: typeof upDays === "number" ? upDays : null });
          return json(201, { id: rec.id, at: rec.at });
        }
        default:
          return json(404, { error: "not found" });
      }
    })().catch((err: unknown) => {
      log(`error: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "something went wrong" }));
      }
    });
  });

  return new Promise<{ url: string; port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(opts.port ?? 0, opts.host ?? "0.0.0.0", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, port, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}
