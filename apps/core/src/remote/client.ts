// The relay tunnel is the Core's one outbound connection besides the Gate: an authenticated WebSocket that carries only
// end-to-end encrypted frames from the household's own paired devices (ADR 0005, gap 21).
import type { LedgerRow, RemoteStatus } from "@woven/schema";
import type { Logger } from "pino";
import WebSocket, { type RawData } from "ws";
import type { RemoteDevices } from "./devices.ts";
import { open, parseFrame, seal, type TunnelRequest, type TunnelResponse } from "./frames.ts";
import type { RelayIdentity } from "./identity.ts";

export const CHALLENGE_PREFIX = "woven-relay|";

function rawText(raw: RawData): string {
  return Buffer.isBuffer(raw) ? raw.toString("utf8") : Array.isArray(raw) ? Buffer.concat(raw).toString("utf8") : Buffer.from(raw).toString("utf8");
}
const MAX_BODY = 32 * 1024 * 1024;

export type Dispatch = (req: { method: string; path: string; headers: Record<string, string>; body: Buffer | null }) => Promise<{ status: number; headers: Record<string, string>; body: Buffer }>;
export type Subscribe = (onRow: (row: LedgerRow) => void) => () => void;

type ClientState = { deviceId: string | null; unsubscribe: (() => void) | null };

/**
 * The Core's end of the relay (gap 21). One outbound WebSocket, opened
 * from inside the house, so the Core still listens on nothing from the
 * internet. The relay sees the Core's public id and ciphertext; every
 * frame is opened with the key of the paired device that sent it, the
 * request inside is handed to the app exactly as if it had arrived on the
 * LAN (with a header saying it came through the relay), and the answer
 * goes back sealed under the same key. Reconnects on its own.
 */
export class RelayClient {
  private socket: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private timer: NodeJS.Timeout | null = null;
  private since: string | null = null;
  private lastError: string | null = null;
  private readonly clients = new Map<string, ClientState>();
  private frames = 0;

  constructor(
    private readonly opts: { url: string; identity: RelayIdentity; devices: RemoteDevices; dispatch: Dispatch; subscribe: Subscribe; logger: Logger },
  ) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close(1000, "core stopping");
    this.socket = null;
  }

  status(): Pick<RemoteStatus, "connected" | "since" | "lastError" | "coreId" | "relay"> {
    return { connected: this.socket?.readyState === WebSocket.OPEN && this.since !== null, since: this.since, lastError: this.lastError, coreId: this.opts.identity.coreId, relay: this.opts.url };
  }

  private connect(): void {
    if (this.stopped) return;
    const url = `${this.opts.url.replace(/\/+$/, "")}/core`;
    const ws = new WebSocket(url, { handshakeTimeout: 15_000 });
    this.socket = ws;
    ws.on("open", () => {
      const ts = Date.now();
      const sig = this.opts.identity.sign(Buffer.from(`${CHALLENGE_PREFIX}${this.opts.identity.coreId}|${ts}`));
      ws.send(JSON.stringify({ t: "hello", pub: this.opts.identity.pubDer.toString("base64url"), ts, sig: sig.toString("base64url") }));
    });
    ws.on("message", (raw: RawData) => void this.onMessage(ws, rawText(raw)));
    ws.on("close", (code, reason) => {
      if (this.socket === ws) this.socket = null;
      for (const c of this.clients.values()) c.unsubscribe?.();
      this.clients.clear();
      if (this.since) this.opts.logger.info({ code, reason: reason.toString() }, "relay connection closed");
      this.since = null;
      this.scheduleReconnect();
    });
    ws.on("error", (err) => {
      this.lastError = err.message;
      this.opts.logger.warn({ err: err.message }, "relay connection failed");
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.timer) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt, 5));
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
    this.timer.unref();
  }

  private async onMessage(ws: WebSocket, text: string): Promise<void> {
    let msg: { t?: string; coreId?: string; c?: string; d?: string };
    try {
      msg = JSON.parse(text) as typeof msg;
    } catch {
      return;
    }
    if (msg.t === "ready") {
      this.since = new Date().toISOString();
      this.attempt = 0;
      this.lastError = null;
      this.opts.logger.info({ relay: this.opts.url, coreId: this.opts.identity.coreId }, "relay attached; the house is reachable from away, end to end encrypted");
      return;
    }
    if (typeof msg.c !== "string") return;
    if (msg.t === "open") {
      this.clients.set(msg.c, { deviceId: null, unsubscribe: null });
      return;
    }
    if (msg.t === "close") {
      this.clients.get(msg.c)?.unsubscribe?.();
      this.clients.delete(msg.c);
      return;
    }
    if (msg.t !== "f" || typeof msg.d !== "string") return;
    const client = this.clients.get(msg.c) ?? { deviceId: null, unsubscribe: null };
    this.clients.set(msg.c, client);
    const frame = parseFrame(msg.d);
    if (!frame) return this.drop(ws, msg.c, "not a frame");
    // A client speaks for one device; a frame under another id on the same connection is dropped with the connection.
    if (client.deviceId && client.deviceId !== frame.d) return this.drop(ws, msg.c, "device changed");
    const key = this.opts.devices.keyFor(frame.d);
    if (!key) return this.drop(ws, msg.c, "unknown or revoked device");
    let req: TunnelRequest;
    try {
      req = JSON.parse(open(key, frame).toString("utf8")) as TunnelRequest;
    } catch {
      return this.drop(ws, msg.c, "frame did not open");
    }
    client.deviceId = frame.d;
    this.frames += 1;
    const send = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "f", c: msg.c, d: seal(key, frame.d, Buffer.from(JSON.stringify(payload))) }));
    };
    if (req.m === "SUB") {
      // The event stream, multiplexed into the same connection: one subscription per client.
      client.unsubscribe?.();
      client.unsubscribe = this.opts.subscribe((row) => send({ i: req.i, ev: { type: "ledger", row } }));
      send({ i: req.i, s: 200, h: {}, b: null } satisfies TunnelResponse);
      return;
    }
    try {
      const body = req.b ? Buffer.from(req.b, "base64") : null;
      if (body && body.length > MAX_BODY) throw new Error("body too large for the relay");
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.h ?? {})) if (typeof v === "string" && !/^(host|connection|content-length|x-woven-via)$/i.test(k)) headers[k.toLowerCase()] = v;
      headers["x-woven-via"] = "relay";
      const res = await this.opts.dispatch({ method: req.m, path: req.p, headers, body });
      const out = res.body.length > MAX_BODY ? res.body.subarray(0, MAX_BODY) : res.body;
      send({ i: req.i, s: res.status, h: res.headers, b: out.length ? out.toString("base64") : null } satisfies TunnelResponse);
    } catch (err) {
      send({ i: req.i, s: 502, h: { "content-type": "application/json" }, b: Buffer.from(JSON.stringify({ error: err instanceof Error ? err.message : "the relay request failed" })).toString("base64") } satisfies TunnelResponse);
    }
  }

  private drop(ws: WebSocket, clientId: string, reason: string): void {
    this.opts.logger.info({ reason }, "dropped a relay client");
    this.clients.get(clientId)?.unsubscribe?.();
    this.clients.delete(clientId);
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "close", c: clientId }));
  }
}
