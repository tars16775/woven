import { CoreConfig, CoreStatus, GateStatus, LedgerRow } from "@woven/schema";
import { z } from "zod";
import { deviceHeaders, signedUrl } from "./device";

/**
 * The typed client for one Core. Every response is parsed against the shared
 * schema, so a field the core does not send is a thrown error here, never an
 * `undefined` that reaches a screen.
 */
export class CoreClient {
  private readonly fetcher: typeof fetch;

  constructor(
    readonly base: string,
    fetcher?: typeof fetch,
  ) {
    // Browsers throw "Illegal invocation" when fetch is called with another `this`.
    this.fetcher = fetcher ?? ((input, init) => globalThis.fetch(input, init));
  }

  private async get<T>(path: string, schema: z.ZodType<T>, timeoutMs = 8000): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetcher(`${this.base}${path}`, { signal: ctrl.signal, cache: "no-store", credentials: "include", headers: deviceHeaders() });
      if (!res.ok) throw new CoreError(res.status, await safeText(res));
      return schema.parse(await res.json());
    } finally {
      clearTimeout(timer);
    }
  }

  status() {
    return this.get("/v1/system/status", CoreStatus);
  }
  config() {
    return this.get("/v1/system/config", CoreConfig);
  }
  recent(limit = 50) {
    return this.get(`/v1/ledger/recent?limit=${limit}`, z.object({ rows: z.array(LedgerRow) })).then((r) => r.rows);
  }
  integrity() {
    return this.get("/v1/ledger/integrity", Integrity);
  }
  gate() {
    return this.get("/v1/gate", GateStatus);
  }

  /** ws(s):// address of the live event stream. */
  eventsUrl(): string {
    return signedUrl(this.base.replace(/^http/, "ws"), "/v1/events");
  }
}

export const Integrity = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), rows: z.number().int(), head: z.string().nullable(), checkedAt: z.string() }),
  z.object({ ok: z.literal(false), rows: z.number().int(), brokenAtSeq: z.number().int(), reason: z.string(), checkedAt: z.string() }),
]);
export type Integrity = z.infer<typeof Integrity>;

export class CoreError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message || `HTTP ${status}`);
    this.name = "CoreError";
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "";
  } catch {
    return "";
  }
}

export type { CoreConfig, CoreStatus, GateStatus, LedgerRow };
