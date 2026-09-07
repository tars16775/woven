"use client";

import { useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth";

/**
 * What guidance a person has already seen (phases 6 to 8).
 *
 * This is a preference, not household data: it says nothing about the house
 * and everything about one person on one device, so it lives in this
 * browser. Two consequences are deliberate.
 *
 * It is keyed by person id, so two people sharing a laptop do not inherit
 * each other's dismissals — a child opening Files for the first time still
 * gets told what Files is, even though a parent read it last week.
 *
 * It is not on the Core. When the Core grows a per-person settings store the
 * shape here moves across unchanged: `seen` is a set of ids and nothing more.
 * Until then a person who signs in on a second device is walked through
 * again, which is the right way round to be wrong.
 */

const listeners = new Set<() => void>();

/** Every piece of guidance that can be dismissed, so a typo cannot hide one forever. */
export type GuideId =
  | "welcome"
  | "tour"
  | "room:overview"
  | "room:ask"
  | "room:files"
  | "room:photos"
  | "room:tv"
  | "room:home"
  | "room:cameras"
  | "room:network"
  | "room:activity"
  | "room:privacy"
  | "room:agents"
  | "room:core"
  | "room:settings";

function keyFor(personId: string | undefined) {
  return `woven:guide:${personId ?? "anon"}`;
}

function read(personId: string | undefined): Set<GuideId> {
  try {
    const raw = localStorage.getItem(keyFor(personId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as GuideId[]) : []);
  } catch {
    return new Set();
  }
}

/* One cached snapshot per person, so useSyncExternalStore sees a stable value. */
const cache = new Map<string, Set<GuideId>>();

function snapshotFor(personId: string | undefined): Set<GuideId> {
  const key = keyFor(personId);
  let v = cache.get(key);
  if (!v) {
    v = read(personId);
    cache.set(key, v);
  }
  return v;
}

const EMPTY: Set<GuideId> = new Set();

function emit(personId: string | undefined) {
  cache.delete(keyFor(personId));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Mark a piece of guidance as read. Idempotent. */
export function markSeen(personId: string | undefined, id: GuideId) {
  const next = new Set(snapshotFor(personId));
  if (next.has(id)) return;
  next.add(id);
  try {
    localStorage.setItem(keyFor(personId), JSON.stringify([...next]));
  } catch {}
  emit(personId);
}

/** Un-mark it, so Settings can offer to show the guidance again. */
export function resetGuide(personId: string | undefined) {
  try {
    localStorage.removeItem(keyFor(personId));
  } catch {}
  emit(personId);
}

/**
 * Whether this person still needs a given piece of guidance, and how to
 * retire it. `ready` is false until the client has looked, so nothing
 * flashes on the server render and then vanishes.
 */
export function useGuide(id: GuideId): { show: boolean; dismiss: () => void } {
  const session = useSession();
  const personId = session?.personId;
  const seen = useSyncExternalStore(
    subscribe,
    () => (session === undefined ? EMPTY : snapshotFor(personId)),
    () => EMPTY,
  );
  return {
    // undefined session means the client has not looked yet: say nothing.
    show: session !== undefined && session !== null && !seen.has(id),
    dismiss: () => markSeen(personId, id),
  };
}

/** The whole set, for the Settings control that brings the guidance back. */
export function useSeenCount(): number {
  const session = useSession();
  const personId = session?.personId;
  const seen = useSyncExternalStore(
    subscribe,
    () => (session === undefined ? EMPTY : snapshotFor(personId)),
    () => EMPTY,
  );
  return seen.size;
}
