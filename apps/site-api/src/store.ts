import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Where the site API keeps what people send it. Two stores, one shape.
 *
 * In production it is Supabase (Postgres behind PostgREST), written with the
 * service key after this service has validated and rate-limited the request;
 * people read their own rows through row security, and nobody else reads any.
 * For development and tests it is append-only JSON lines in a folder, which
 * needs no network and no keys.
 *
 * Nothing in either store is household data.
 */
export type Kind = "reservations" | "applications" | "contact" | "pings";

export type Stored = {
  id: string;
  kind: Kind;
  at: string;
  body: Record<string, unknown>;
  /** The signed-in account that sent it, when there was one. */
  userId: string | null;
};

export interface Store {
  put(kind: Kind, body: Record<string, unknown>, userId: string | null): Promise<Stored>;
  list(kind: Kind): Promise<Stored[]>;
}

export const KINDS: readonly Kind[] = ["reservations", "applications", "contact", "pings"];
export const isKind = (s: string): s is Kind => (KINDS as readonly string[]).includes(s);

/** JSON lines on disk. The development store, and what the Railway volume held before Supabase. */
export class FileStore implements Store {
  constructor(private readonly dir: string) {}

  async put(kind: Kind, body: Record<string, unknown>, userId: string | null): Promise<Stored> {
    await mkdir(this.dir, { recursive: true });
    const rec: Stored = { id: randomBytes(8).toString("hex"), kind, at: new Date().toISOString(), body, userId };
    await appendFile(join(this.dir, `${kind}.jsonl`), `${JSON.stringify(rec)}\n`);
    return rec;
  }

  async list(kind: Kind): Promise<Stored[]> {
    try {
      return (await readFile(join(this.dir, `${kind}.jsonl`), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((l) => ({ userId: null, ...(JSON.parse(l) as Omit<Stored, "userId"> & { userId?: string | null }) }));
    } catch {
      return [];
    }
  }
}

/** One table per kind. The names differ where the plain word would mislead. */
const TABLE: Record<Kind, string> = { reservations: "reservations", applications: "applications", contact: "contact_messages", pings: "core_pings" };

type Row = Record<string, unknown> & { id: string; created_at: string };

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Which columns each kind gets first-class, beyond the whole body kept in `details`. */
function toRow(kind: Kind, body: Record<string, unknown>, userId: string | null): Record<string, unknown> {
  switch (kind) {
    case "reservations":
      return { code: body.code, tier: body.tier, total: body.total, email: str(body.email), name: str(body.name), user_id: userId, details: body };
    case "applications":
      return { code: body.code, email: body.email, city: body.city, user_id: userId, details: body };
    case "contact":
      return { email: body.email, message: body.message, user_id: userId };
    case "pings":
      // No identifiers, and none derived: `userId` is deliberately not stored.
      return { version: body.version, kind: body.kind ?? "unknown", up_days: body.upDays ?? null };
  }
}

/** Back to the shape the admin list and the tests have always had. */
function fromRow(kind: Kind, row: Row): Stored {
  const { id, created_at, user_id, details, ...rest } = row;
  const body = kind === "pings" ? { version: rest.version, kind: rest.kind, upDays: rest.up_days ?? null } : ((details as Record<string, unknown> | undefined) ?? rest);
  return { id, kind, at: created_at, body, userId: (user_id as string | null | undefined) ?? null };
}

export type SupabaseStoreOptions = {
  url: string;
  /** The service key. It bypasses row security, which is why only this service holds it. */
  secretKey: string;
  fetcher?: typeof fetch;
};

/** PostgREST, spoken directly. Small enough that a client library would be more code than this. */
export class SupabaseStore implements Store {
  private readonly base: string;
  private readonly headers: Record<string, string>;
  private readonly fetcher: typeof fetch;

  constructor(opts: SupabaseStoreOptions) {
    this.base = `${opts.url.replace(/\/+$/, "")}/rest/v1`;
    this.headers = { apikey: opts.secretKey, authorization: `Bearer ${opts.secretKey}`, "content-type": "application/json" };
    this.fetcher = opts.fetcher ?? fetch;
  }

  async put(kind: Kind, body: Record<string, unknown>, userId: string | null): Promise<Stored> {
    const res = await this.fetcher(`${this.base}/${TABLE[kind]}`, {
      method: "POST",
      headers: { ...this.headers, prefer: "return=representation" },
      body: JSON.stringify(toRow(kind, body, userId)),
    });
    if (!res.ok) throw new Error(`supabase insert into ${TABLE[kind]}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const [row] = (await res.json()) as Row[];
    if (!row) throw new Error(`supabase insert into ${TABLE[kind]}: no row returned`);
    return fromRow(kind, row);
  }

  async list(kind: Kind): Promise<Stored[]> {
    const res = await this.fetcher(`${this.base}/${TABLE[kind]}?select=*&order=created_at.desc&limit=500`, { headers: this.headers });
    if (!res.ok) throw new Error(`supabase list ${TABLE[kind]}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as Row[]).map((r) => fromRow(kind, r));
  }
}
