"use client";

import { useSyncExternalStore } from "react";
import { deposit as depositAmount } from "./order";
import { tiers, type TierId } from "./site";

/**
 * Reservations kept on this device until the ordering service exists. This
 * is the list the configurator writes to and /order/status reads from. Nothing
 * here is sent anywhere; the code is the handle the person keeps.
 */
export type ReservationStatus = "reserved" | "cancelled";

export type Reservation = {
  code: string;
  tier: TierId;
  finish: string;
  storage: string;
  cloud: string;
  addons: string[];
  total: number;
  deposit: number;
  createdAt: number;
  status: ReservationStatus;
  cancelledAt?: number;
  /** Attached when a session existed at the time of reserving. */
  name?: string;
  email?: string;
};

export type NewReservation = Omit<Reservation, "code" | "createdAt" | "status" | "deposit" | "cancelledAt">;

const KEY = "woven:orders";
/** Single-slot key the first configurator wrote. Migrated into the list on first read. */
const LEGACY_KEY = "woven:reservation";

const listeners = new Set<() => void>();

function isTier(v: unknown): v is TierId {
  return typeof v === "string" && v in tiers;
}

function sane(r: unknown): r is Reservation {
  if (!r || typeof r !== "object") return false;
  const x = r as Record<string, unknown>;
  return typeof x.code === "string" && isTier(x.tier) && typeof x.total === "number";
}

function read(): Reservation[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(sane) : [];
  } catch {
    return [];
  }
}

function write(list: Reservation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

/** Move a reservation saved under the old single key into the list. Idempotent. */
function migrate(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    localStorage.removeItem(LEGACY_KEY);
    const old = JSON.parse(raw) as Record<string, unknown>;
    if (typeof old.code !== "string" || !isTier(old.tier)) return false;
    const list = read();
    if (list.some((r) => r.code === old.code)) return false;
    const r: Reservation = {
      code: old.code,
      tier: old.tier,
      finish: typeof old.finish === "string" ? old.finish : "bone",
      storage: typeof old.storage === "string" ? old.storage : "",
      cloud: typeof old.cloud === "string" ? old.cloud : "none",
      addons: Array.isArray(old.addons) ? old.addons.filter((a): a is string => typeof a === "string") : [],
      total: typeof old.total === "number" ? old.total : 0,
      deposit: depositAmount,
      createdAt: typeof old.at === "number" ? old.at : Date.now(),
      status: "reserved",
    };
    write([r, ...list]);
    return true;
  } catch {
    return false;
  }
}

let cache: Reservation[] | undefined;
function snapshot(): Reservation[] {
  if (cache === undefined) cache = read();
  return cache;
}
function emit() {
  cache = undefined;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  // Subscribing happens in an effect, so this is the right moment for the
  // one-time migration side effect rather than during render.
  if (migrate()) emit();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === LEGACY_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Newest first. undefined while the client has not looked yet. */
export function useReservations(): Reservation[] | undefined {
  const list = useSyncExternalStore(subscribe, snapshot, () => undefined);
  return list ? [...list].sort((a, b) => b.createdAt - a.createdAt) : undefined;
}

export function normalizeCode(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

export function makeReservationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(4);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `WV-${s}${Date.now().toString().slice(-3)}`;
}

export function addReservation(input: NewReservation): Reservation {
  migrate();
  const list = read();
  let code = makeReservationCode();
  while (list.some((r) => r.code === code)) code = makeReservationCode();
  const r: Reservation = {
    ...input,
    name: input.name?.trim() || undefined,
    email: input.email?.trim() || undefined,
    code,
    deposit: depositAmount,
    createdAt: Date.now(),
    status: "reserved",
  };
  write([r, ...list]);
  emit();
  return r;
}

export function cancelReservation(code: string): Reservation | undefined {
  const list = read();
  const i = list.findIndex((r) => r.code === code);
  if (i < 0) return undefined;
  const r: Reservation = { ...list[i], status: "cancelled", cancelledAt: Date.now() };
  list[i] = r;
  write(list);
  emit();
  return r;
}

export function getReservation(code: string): Reservation | undefined {
  return read().find((r) => r.code === normalizeCode(code));
}
