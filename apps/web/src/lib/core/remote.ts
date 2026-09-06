"use client";

import type { LedgerRow, RemotePairing } from "@woven/schema";

/**
 * The browser's end of the relay (gap 21). A pairing made at home holds a
 * 32-byte frame key, a bearer token, the relay address and the Core's id.
 * Away from home the dashboard opens one WebSocket to the relay, seals
 * every request under the key with AES-GCM (the device id as associated
 * data) and opens the answers. The relay sees ciphertext; the Core sees
 * the same request it would have seen on the home network, marked as
 * having come through the relay.
 */
const PAIRING = "woven:remote";
export const REMOTE_BASE = "remote://core";

export type Pairing = RemotePairing;

export function loadPairing(): Pairing | null {
  try {
    const raw = localStorage.getItem(PAIRING);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pairing;
    return p && typeof p.key === "string" && typeof p.coreId === "string" ? p : null;
  } catch {
    return null;
  }
}

export function savePairing(p: Pairing | null) {
  try {
    if (p) localStorage.setItem(PAIRING, JSON.stringify(p));
    else localStorage.removeItem(PAIRING);
  } catch {}
}

type Pending = { resolve: (r: TunnelResponse) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
type TunnelResponse = { i: string; s: number; h: Record<string, string>; b: string | null };

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export class RemoteTunnel {
  private ws: WebSocket | null = null;
  private key: CryptoKey | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<(row: LedgerRow) => void>();
  private seq = 0;
  private subscribed = false;
  onClose: ((code: number, reason: string) => void) | null = null;

  constructor(readonly pairing: Pairing) {}

  async connect(timeoutMs = 8000): Promise<void> {
    this.key = await crypto.subtle.importKey("raw", unb64(this.pairing.key), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    const url = `${this.pairing.relay.replace(/^http/, "ws").replace(/\/+$/, "")}/c/${this.pairing.coreId}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("the relay did not answer"));
      }, timeoutMs);
      ws.onmessage = (ev) => {
        // The first message is the relay's ready; everything after is a sealed frame.
        clearTimeout(timer);
        ws.onmessage = (e) => void this.onFrame(String(e.data));
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("could not reach the relay"));
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(new Error(e.code === 4404 || e.code === 4410 ? "your Core is not connected to the relay" : "the relay connection closed"));
        }
        this.pending.clear();
        this.ws = null;
        if (e.code === 4404) reject(new Error("your Core is not connected to the relay right now"));
        else reject(new Error("the relay closed the connection"));
        this.onClose?.(e.code, e.reason);
      };
      this.ws = ws;
    });
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.onClose = null;
    this.ws?.close();
    this.ws = null;
  }

  /** One HTTP request through the tunnel; the answer comes back as a Response so callers cannot tell. */
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.pairing.token}` };
    const h = new Headers(init.headers ?? {});
    h.forEach((v, k) => {
      headers[k] = v;
    });
    let body: string | null = null;
    if (init.body !== undefined && init.body !== null) {
      const bytes = typeof init.body === "string" ? enc.encode(init.body) : init.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : init.body instanceof ArrayBuffer ? new Uint8Array(init.body) : ArrayBuffer.isView(init.body) ? new Uint8Array(init.body.buffer.slice(init.body.byteOffset, init.body.byteOffset + init.body.byteLength) as ArrayBuffer) : null;
      if (!bytes) throw new Error("that body cannot travel through the relay");
      body = b64(bytes);
    }
    const r = await this.send({ m: (init.method ?? "GET").toUpperCase(), p: path, h: headers, b: body });
    const bytes = r.b ? unb64(r.b) : null;
    const status = r.s >= 200 && r.s <= 599 ? r.s : 502;
    return new Response(status === 204 || status === 304 ? null : (bytes as BodyInit | null), { status, headers: r.h });
  }

  /** The ledger stream, multiplexed into this connection. */
  subscribe(onRow: (row: LedgerRow) => void): () => void {
    this.listeners.add(onRow);
    if (!this.subscribed) {
      this.subscribed = true;
      void this.send({ m: "SUB", p: "/v1/events", h: {}, b: null }).catch(() => undefined);
    }
    return () => {
      this.listeners.delete(onRow);
    };
  }

  private async send(req: { m: string; p: string; h: Record<string, string>; b: string | null }): Promise<TunnelResponse> {
    if (!this.ws || !this.key || this.ws.readyState !== WebSocket.OPEN) throw new Error("not connected to the relay");
    const i = `${Date.now().toString(36)}-${(this.seq += 1)}`;
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plain = enc.encode(JSON.stringify({ i, ...req }));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: enc.encode(this.pairing.deviceId) }, this.key, plain as BufferSource));
    const frame = JSON.stringify({ d: this.pairing.deviceId, n: b64(nonce), c: b64(ct) });
    return new Promise<TunnelResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(i);
        reject(new Error("the Core did not answer through the relay"));
      }, 60_000);
      this.pending.set(i, { resolve, reject, timer });
      this.ws!.send(frame);
    });
  }

  private async onFrame(text: string) {
    if (!this.key) return;
    let frame: { d?: string; n?: string; c?: string };
    try {
      frame = JSON.parse(text) as typeof frame;
    } catch {
      return;
    }
    if (typeof frame.n !== "string" || typeof frame.c !== "string") return;
    let msg: { i: string; s?: number; h?: Record<string, string>; b?: string | null; ev?: { type: string; row?: LedgerRow } };
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(frame.n), additionalData: enc.encode(this.pairing.deviceId) }, this.key, unb64(frame.c) as BufferSource);
      msg = JSON.parse(dec.decode(plain)) as typeof msg;
    } catch {
      return;
    }
    if (msg.ev) {
      if (msg.ev.type === "ledger" && msg.ev.row) for (const l of this.listeners) l(msg.ev.row);
      return;
    }
    const p = this.pending.get(msg.i);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(msg.i);
    p.resolve({ i: msg.i, s: msg.s ?? 502, h: msg.h ?? {}, b: msg.b ?? null });
  }
}
