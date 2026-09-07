"use client";

import { useSyncExternalStore } from "react";

/**
 * The dashboard's local reflection of a session a Core issued. The cookie on
 * the Core is the real thing; this only tells the shell who is here and which
 * house they reached. Nothing here is ever invented: without a Core there is
 * no session at all.
 */
export type Session = {
  household: string;
  name: string;
  email: string;
  method: "passkey" | "code" | "email" | "recovery" | "remote";
  at: number;
  /** The person the Core signed in. */
  personId?: string;
  role?: "owner" | "adult" | "child" | "guest";
};

const KEY = "woven:session";
const listeners = new Set<() => void>();

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let cache: Session | null | undefined;
function snapshot() {
  if (cache === undefined) cache = read();
  return cache;
}
function emit() {
  cache = undefined;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** null when signed out; undefined while the client has not looked yet. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

export function signIn(s: Omit<Session, "at">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {}
  emit();
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("woven:device");
  } catch {}
  emit();
}

/**
 * A display name from the local part of an email: "sam.o-brien+home@x.com"
 * becomes "Sam O-brien". Used when someone signs in by email or passkey and
 * we have nothing better to call them yet.
 */
export function displayNameFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  const base = local.split("+")[0] ?? "";
  const words = base
    .split(/[._\s]+/)
    .filter(Boolean)
    .map((w) => w.replace(/\d+$/, ""))
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length ? words.join(" ") : "Someone";
}

/** "Sam" becomes "Sam's house"; "James" becomes "James' house". */
export function householdFor(name: string): string {
  const n = name.trim() || "Your";
  return n.endsWith("s") ? `${n}' house` : `${n}'s house`;
}
