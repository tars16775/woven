"use client";

import { useSyncExternalStore } from "react";

/**
 * Founding Homes applications, kept on this device. There is no intake
 * service yet, so an application is a saved draft with a code; when
 * applications open, the person is asked to submit it. Nothing is sent.
 */
export type Application = {
  code: string;
  name: string;
  email: string;
  city: string;
  people: string;
  setup: string[];
  why: string;
  createdAt: number;
  updatedAt: number;
  status: "saved";
};

export type ApplicationInput = Omit<Application, "code" | "createdAt" | "updatedAt" | "status"> & {
  /** Pass an existing code to update that application in place. */
  code?: string;
};

const KEY = "woven:applications";
/** Single-slot key the first form wrote. Migrated into the list on subscribe. */
const LEGACY_KEY = "woven:founding-home";

const listeners = new Set<() => void>();

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function sane(a: unknown): a is Application {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.code === "string" && typeof x.email === "string";
}

function read(): Application[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(sane) : [];
  } catch {
    return [];
  }
}

function write(list: Application[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

function migrate(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    localStorage.removeItem(LEGACY_KEY);
    const old = JSON.parse(raw) as Record<string, unknown>;
    if (typeof old.code !== "string") return false;
    const list = read();
    if (list.some((a) => a.code === old.code)) return false;
    const at = typeof old.at === "number" ? old.at : Date.now();
    const a: Application = {
      code: old.code,
      name: str(old.name),
      email: str(old.email),
      city: str(old.city),
      people: str(old.people),
      setup: Array.isArray(old.setup) ? old.setup.filter((s): s is string => typeof s === "string") : [],
      why: str(old.why),
      createdAt: at,
      updatedAt: at,
      status: "saved",
    };
    write([a, ...list]);
    return true;
  } catch {
    return false;
  }
}

let cache: Application[] | undefined;
function snapshot(): Application[] {
  if (cache === undefined) cache = read();
  return cache;
}
function emit() {
  cache = undefined;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
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

/** Most recently updated first. undefined while the client has not looked yet. */
export function useApplications(): Application[] | undefined {
  const list = useSyncExternalStore(subscribe, snapshot, () => undefined);
  return list ? [...list].sort((a, b) => b.updatedAt - a.updatedAt) : undefined;
}

export function makeApplicationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `FH-${s}`;
}

/** Create, or update in place when `code` matches a saved application. */
export function saveApplication(input: ApplicationInput): Application {
  migrate();
  const list = read();
  const now = Date.now();
  const clean = {
    name: input.name.trim(),
    email: input.email.trim(),
    city: input.city.trim(),
    people: input.people.trim(),
    setup: input.setup,
    why: input.why.trim(),
  };
  const i = input.code ? list.findIndex((a) => a.code === input.code) : -1;
  let a: Application;
  if (i >= 0) {
    a = { ...list[i], ...clean, updatedAt: now };
    list[i] = a;
  } else {
    let code = makeApplicationCode();
    while (list.some((x) => x.code === code)) code = makeApplicationCode();
    a = { ...clean, code, createdAt: now, updatedAt: now, status: "saved" };
    list.unshift(a);
  }
  write(list);
  emit();
  return a;
}
