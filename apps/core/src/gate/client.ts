/* eslint-disable no-restricted-globals -- this file is the core's only way out: it talks to the Gate on loopback (ADR 0005). */
import type { GateStatus } from "@woven/schema";

export type CrossRequest = { actionId: string; host: string; method: "GET" | "POST"; path: string; body?: string | undefined; bodyBase64?: string | undefined; headers?: Record<string, string> | undefined };
export type CrossResult = { status: number; bytesOut: number; bytesIn: number; durationMs: number; body: string };
export type FetchResult = { status: number; bytesIn: number; sha256: string; hops: string[]; durationMs: number };

export class GateError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GateError";
  }
}

/**
 * The core's client for the Gate process. Loopback only, authenticated with
 * a secret the core minted when it started the Gate. `absent` means no Gate
 * is running: every crossing fails and says so.
 */
export class GateClient {
  private lastStatus: GateStatus = { state: "absent", changedAt: null, changedBy: null, allowList: [], crossingsToday: 0, bytesOutToday: 0 };

  constructor(
    readonly url: string | null,
    private readonly secret: string,
  ) {}

  isOpen(): boolean {
    return this.lastStatus.state === "open";
  }

  cached(): GateStatus {
    return this.lastStatus;
  }

  async status(): Promise<GateStatus> {
    if (!this.url) return this.lastStatus;
    try {
      this.lastStatus = (await this.call("GET", "/status")) as GateStatus;
    } catch {
      this.lastStatus = { ...this.lastStatus, state: "absent" };
    }
    return this.lastStatus;
  }

  async setOpen(open: boolean, by: string): Promise<{ state: string }> {
    if (!this.url) throw new GateError(503, "No Gate is running.");
    this.lastStatus = (await this.call("POST", open ? "/open" : "/close", { by })) as GateStatus;
    return { state: this.lastStatus.state };
  }

  /** Owner-only, class H on the core's side: add or remove a host crossings may reach. */
  async setAllowed(host: string, allowed: boolean, by: string): Promise<GateStatus> {
    if (!this.url) throw new GateError(503, "No Gate is running.");
    this.lastStatus = (await this.call("POST", allowed ? "/allow" : "/disallow", { host, by })) as GateStatus;
    return this.lastStatus;
  }

  isAllowed(host: string): boolean {
    const h = host.toLowerCase();
    return this.lastStatus.allowList.some((a) => (a.startsWith("*.") ? h === a.slice(2) || h.endsWith(a.slice(1)) : h === a));
  }

  async cross(req: CrossRequest): Promise<CrossResult> {
    if (!this.url) throw new GateError(503, "No Gate is running; nothing can cross.");
    return (await this.call("POST", "/cross", req)) as CrossResult;
  }

  /** Stream a large file (a model, an update) to `dest` inside the data root. May take minutes. */
  async download(req: { actionId: string; url: string; dest: string; maxBytes?: number }): Promise<FetchResult> {
    if (!this.url) throw new GateError(503, "No Gate is running; nothing can cross.");
    return (await this.call("POST", "/fetch", req, 60 * 60 * 1000)) as FetchResult;
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 30_000): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.secret}` },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = text;
        try {
          message = (JSON.parse(text) as { error?: string }).error ?? text;
        } catch {}
        throw new GateError(res.status, message || `Gate answered ${res.status}`);
      }
      return JSON.parse(text) as unknown;
    } catch (err) {
      if (err instanceof GateError) throw err;
      throw new GateError(503, err instanceof Error && err.name === "AbortError" ? "The Gate did not answer in time." : "The Gate is not reachable.");
    } finally {
      clearTimeout(timer);
    }
  }
}
