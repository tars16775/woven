"use client";

import { useSyncExternalStore } from "react";
import { en, type Messages } from "./en";
import { de } from "./de";

/**
 * The language layer (gap 29). Every string a screen shows can come from a
 * dictionary keyed by a stable id; English is the source of truth and any
 * other language falls back to it key by key, so a half-translated
 * dictionary never leaves a blank. The locale follows the browser unless a
 * person chose one in Settings.
 */
export type Locale = "en" | "de";
export const locales: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
];

const dictionaries: Record<Locale, Partial<Messages>> = { en, de };
const KEY = "woven:locale";
const listeners = new Set<() => void>();

function detect(): Locale {
  try {
    const chosen = localStorage.getItem(KEY);
    if (chosen === "en" || chosen === "de") return chosen;
  } catch {}
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de")) return "de";
  return "en";
}

let current: Locale | null = null;
function snapshot(): Locale {
  if (current === null) current = detect();
  return current;
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(KEY, locale);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export type MessageKey = keyof Messages;

/** Translate a key, with `{name}` placeholders filled from `vars`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}, locale: Locale = snapshot()): string {
  const text = dictionaries[locale][key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** The current locale and a translator that re-renders when it changes. */
export function useT(): { locale: Locale; t: (key: MessageKey, vars?: Record<string, string | number>) => string } {
  const locale = useSyncExternalStore(subscribe, snapshot, () => "en" as Locale);
  return { locale, t: (key, vars) => t(key, vars, locale) };
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, snapshot, () => "en" as Locale);
}

/** Every key present in English and missing elsewhere; a test keeps this list visible. */
export function untranslated(locale: Locale): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter((k) => !(k in dictionaries[locale]));
}
