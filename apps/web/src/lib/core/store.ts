"use client";

import { useSyncExternalStore } from "react";
import { CoreClient, CoreError, type CoreConfig, type CoreStatus, type GateStatus, type LedgerRow } from "./client";
import { LIVE, defaultCandidates, discover, normalize, probe, remember } from "./discovery";
import { REMOTE_BASE, RemoteTunnel, loadPairing } from "./remote";

/**
 * One connection to the household's Core, shared by every dashboard surface.
 *
 * off          the build never looks for a Core (marketing deploy)
 * searching    probing the household name and this machine
 * connected    polling status, streaming the ledger over a WebSocket
 * unreachable  nothing answered; the Core page explains how to connect
 */
export type CoreState =
  | { phase: "off" }
  | { phase: "searching"; tried: string[] }
  | { phase: "connected"; url: string; version: string; status: CoreStatus | null; config: CoreConfig | null; gate: GateStatus | null; rows: LedgerRow[]; since: number; remote?: RemoteTunnel }
  | { phase: "unreachable"; tried: string[]; reason: string };

const initial: CoreState = LIVE ? { phase: "searching", tried: [] } : { phase: "off" };
let state: CoreState = initial;
const listeners = new Set<() => void>();
let client: CoreClient | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let socket: WebSocket | null = null;
let started = false;
let generation = 0;

function set(next: CoreState) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useCore(): CoreState {
  return useSyncExternalStore(subscribe, () => state, () => initial);
}

/** The client for the connected Core, or null. */
export function coreClient(): CoreClient | null {
  return client;
}

/** The current state outside React (event handlers, stores). */
export function coreState(): CoreState {
  return state;
}

/** Re-read status and the Gate now (after an action that changed them). */
export async function refreshCore(): Promise<void> {
  if (!client || state.phase !== "connected") return;
  try {
    const [status, gate] = await Promise.all([client.status(), client.gate().catch(() => null)]);
    if (state.phase === "connected") set({ ...state, status, gate: gate ?? state.gate });
  } catch {}
}

/** Begin looking, once. Safe to call from every mount. */
export function startCore() {
  if (!LIVE || started) return;
  started = true;
  void search(defaultCandidates());
}

export function retryCore() {
  if (!LIVE) return;
  teardown();
  void search(defaultCandidates());
}

/** A person typed an address on the Core page. */
export async function connectTo(input: string): Promise<boolean> {
  if (!LIVE) return false;
  const url = normalize(input);
  teardown();
  set({ phase: "searching", tried: [url] });
  const result = await probe(url);
  if (!result.ok) {
    set({ phase: "unreachable", tried: [url], reason: result.reason });
    return false;
  }
  attach(url, result.version);
  return true;
}

/** Away from home: reach the paired Core through the relay (gap 21). */
export async function connectRemote(): Promise<boolean> {
  const pairing = loadPairing();
  if (!LIVE || !pairing) return false;
  teardown();
  set({ phase: "searching", tried: [pairing.relay] });
  const tunnel = new RemoteTunnel(pairing);
  try {
    await tunnel.connect();
  } catch (err) {
    set({ phase: "unreachable", tried: [pairing.relay], reason: err instanceof Error ? err.message : "the relay did not answer" });
    return false;
  }
  const health = await probe(REMOTE_BASE, 8000, (input, init) => tunnel.fetch(String(input).slice(REMOTE_BASE.length), init));
  if (!health.ok) {
    tunnel.close();
    set({ phase: "unreachable", tried: [pairing.relay], reason: health.reason });
    return false;
  }
  attach(REMOTE_BASE, health.version, tunnel);
  return true;
}

async function search(candidates: string[]) {
  const gen = ++generation;
  set({ phase: "searching", tried: candidates });
  const url = await discover(candidates);
  if (gen !== generation) return;
  if (!url) {
    // Nothing at home answered: a paired browser tries the relay before giving up.
    if (loadPairing() && (await connectRemote())) return;
    if (gen !== generation) return;
    set({ phase: "unreachable", tried: candidates, reason: "no answer" });
    return;
  }
  const first = await probe(url);
  if (gen !== generation) return;
  if (!first.ok) {
    set({ phase: "unreachable", tried: candidates, reason: first.reason });
    return;
  }
  attach(url, first.version);
}

function attach(url: string, version: string, remote?: RemoteTunnel) {
  const gen = ++generation;
  if (!remote) remember(url);
  client = remote ? new CoreClient(url, (input, init) => remote.fetch(String(input).slice(REMOTE_BASE.length), init)) : new CoreClient(url);
  set({ phase: "connected", url, version, status: null, config: null, gate: null, rows: [], since: Date.now(), ...(remote ? { remote } : {}) });
  if (remote) {
    remote.onClose = () => {
      if (gen === generation) lost("the relay connection closed");
    };
  }

  const refresh = async () => {
    if (!client || gen !== generation) return;
    try {
      const [status, gate] = await Promise.all([client.status(), client.gate().catch(() => null)]);
      if (gen !== generation || state.phase !== "connected") return;
      set({ ...state, status, gate: gate ?? state.gate });
    } catch (err) {
      if (gen !== generation) return;
      // Not signed in on this device: still connected, just nothing to show until sign-in.
      if (err instanceof CoreError && err.status === 401) {
        if (state.phase === "connected") set({ ...state, status: null });
        return;
      }
      lost("the Core stopped answering");
    }
  };
  void refresh();
  poll = setInterval(() => void refresh(), 5000);

  void client.config().then((config) => {
    if (gen === generation && state.phase === "connected") set({ ...state, config });
  }).catch(() => undefined);
  void client.recent(60).then((rows) => {
    if (gen === generation && state.phase === "connected") set({ ...state, rows: mergeRows(rows, state.rows) });
  }).catch(() => undefined);

  if (remote) {
    const unsubscribe = remote.subscribe((row) => {
      if (gen === generation && state.phase === "connected") set({ ...state, rows: mergeRows([row], state.rows) });
    });
    remoteUnsubscribe = unsubscribe;
    return;
  }
  try {
    socket = new WebSocket(client.eventsUrl());
    socket.onmessage = (ev) => {
      if (gen !== generation || state.phase !== "connected") return;
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; row?: LedgerRow };
        if (msg.type === "ledger" && msg.row) set({ ...state, rows: mergeRows([msg.row], state.rows) });
      } catch {}
    };
    socket.onclose = () => {
      if (gen === generation && state.phase === "connected") scheduleReconnect(gen);
    };
    socket.onerror = () => socket?.close();
  } catch {
    // Streaming is optional; polling still works.
  }
}

/** Newest first, de-duplicated by seq, capped for the Activity page. */
function mergeRows(incoming: LedgerRow[], existing: LedgerRow[]): LedgerRow[] {
  const bySeq = new Map<number, LedgerRow>();
  for (const r of [...existing, ...incoming]) bySeq.set(r.seq, r);
  return [...bySeq.values()].sort((a, b) => b.seq - a.seq).slice(0, 200);
}

let remoteUnsubscribe: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReconnect(gen: number) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (gen !== generation || state.phase !== "connected" || !client) return;
    const url = client.base;
    const version = state.version;
    teardown({ keepState: true });
    attach(url, version);
  }, 3000);
}

function lost(reason: string) {
  const tried = client ? [client.base] : [];
  teardown();
  set({ phase: "unreachable", tried, reason });
  // Keep looking quietly; the Mac may be waking up or the core restarting.
  setTimeout(() => {
    if (state.phase === "unreachable") void search(defaultCandidates());
  }, 10_000);
}

function teardown(opts: { keepState?: boolean } = {}) {
  generation += 1;
  remoteUnsubscribe?.();
  remoteUnsubscribe = null;
  if (state.phase === "connected" && state.remote) state.remote.close();
  if (poll) clearInterval(poll);
  poll = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    try {
      socket.close();
    } catch {}
  }
  socket = null;
  if (!opts.keepState) client = null;
}

/** Test seam: reset module state between tests. */
export function __resetCoreStore() {
  teardown();
  started = false;
  client = null;
  state = initial;
  listeners.forEach((l) => l());
}
