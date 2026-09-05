"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Dashboard colour scheme. The preference lives in localStorage under
 * "woven:theme" and resolves against prefers-color-scheme when set to
 * "system". The resolved value is applied as `data-dash-theme` on the
 * dashboard root; <ThemeStyle /> swaps the palette tokens under it, so
 * every `bg-bone`, `text-ink`, `ring-ink/5` and friend flips with it.
 * Graphite surfaces (`.bg-graphite`, `.dash-lock`) are dark in both schemes,
 * so under them the tokens are pinned back to the light set.
 *
 * Testing: append `?theme=dark` (or light, system) to any dashboard URL and
 * the provider honours it for that page load without touching the stored
 * preference. Choosing a theme in Settings clears the override.
 */
export type ThemePref = "system" | "light" | "dark";
export type ThemeResolved = "light" | "dark";
export type ThemeState = { pref: ThemePref; resolved: ThemeResolved };

const KEY = "woven:theme";
const SERVER: ThemeState = { pref: "system", resolved: "light" };
const listeners = new Set<() => void>();

let cache: ThemeState | undefined;
let override: ThemePref | null | undefined; // from ?theme=, read once
let mq: MediaQueryList | null = null;

function isPref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

function media() {
  if (!mq && typeof window !== "undefined" && "matchMedia" in window) {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
  }
  return mq;
}

function readPref(): ThemePref {
  if (override === undefined) {
    try {
      const q = new URLSearchParams(window.location.search).get("theme");
      override = isPref(q) ? q : null;
    } catch {
      override = null;
    }
  }
  if (override) return override;
  try {
    const raw = localStorage.getItem(KEY);
    return isPref(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

function snapshot(): ThemeState {
  if (!cache) {
    const pref = readPref();
    const resolved: ThemeResolved = pref === "system" ? (media()?.matches ? "dark" : "light") : pref;
    cache = { pref, resolved };
  }
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
  const m = media();
  m?.addEventListener("change", emit);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
    m?.removeEventListener("change", emit);
  };
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

export function setTheme(pref: ThemePref) {
  override = null;
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  emit();
}

/* Dark palette. Amber stays; everything else swaps role. */
const dark = {
  bone: "#121211",
  bone2: "#191918",
  chassis: "#2a2a28",
  chassis2: "#3d3d3a",
  white: "#1c1c1b",
  ink: "#f3f2ee",
  ash: "#9b9993",
  ash2: "#7a786f",
  local: "#7fcf98",
  localBg: "rgba(111, 192, 138, 0.14)",
  ask: "#e8b85a",
  askBg: "rgba(232, 184, 90, 0.14)",
};

/* Light palette, restated so graphite surfaces can lock to it in dark mode. */
const light = {
  bone: "#f3f2ee",
  bone2: "#eae8e2",
  chassis: "#e2e0da",
  chassis2: "#c9c7c0",
  white: "#ffffff",
  ink: "#1a1a1a",
  ash: "#6e6c66",
  ash2: "#9b9993",
  local: "#2f7a4c",
  localBg: "#e7f2ea",
  ask: "#b4841e",
  askBg: "#fbf1dc",
};

function tokens(p: typeof dark) {
  return [
    `--color-bone:${p.bone}`,
    `--color-bone-2:${p.bone2}`,
    `--color-chassis:${p.chassis}`,
    `--color-chassis-2:${p.chassis2}`,
    `--color-white:${p.white}`,
    `--color-ink:${p.ink}`,
    `--color-ash:${p.ash}`,
    `--color-ash-2:${p.ash2}`,
    `--color-local:${p.local}`,
    `--color-local-bg:${p.localBg}`,
    `--color-ask:${p.ask}`,
    `--color-ask-bg:${p.askBg}`,
  ].join(";");
}

const css = `
[data-dash-theme="dark"]{${tokens(dark)};color-scheme:dark;--btn-secondary-bg:rgba(255,255,255,0.1);--btn-secondary-fg:#f3f2ee}
[data-dash-theme="dark"] .btn-primary{color:#1a1a1a}
[data-dash-theme="dark"] .ring-ink\\/5,[data-dash-theme="dark"] .ring-ink\\/8{--tw-ring-color:rgba(255,255,255,0.08)}
[data-dash-theme="dark"] .divide-ink\\/6>:not(:last-child){border-color:rgba(255,255,255,0.08)}
[data-dash-theme="dark"] .border-ink\\/8{border-color:rgba(255,255,255,0.08)}
[data-dash-theme="dark"] .dash-lock,[data-dash-theme="dark"] .bg-graphite{${tokens(light)};color-scheme:dark;--btn-secondary-bg:rgba(243,242,238,0.88);--btn-secondary-fg:#1a1a1a}
`;

/** Palette overrides for the dashboard root. Render once inside the root. */
export function ThemeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/** Paints the document behind the dashboard so overscroll matches. */
export function useDocumentTheme(resolved: ThemeResolved) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prev = { scheme: root.style.colorScheme, bg: body.style.backgroundColor };
    root.style.colorScheme = resolved;
    body.style.backgroundColor = resolved === "dark" ? dark.bone : light.bone;
    return () => {
      root.style.colorScheme = prev.scheme;
      body.style.backgroundColor = prev.bg;
    };
  }, [resolved]);
}

const options: { id: ThemePref; label: string; hint: string }[] = [
  { id: "system", label: "System", hint: "Follows the device" },
  { id: "light", label: "Light", hint: "Bone" },
  { id: "dark", label: "Dark", hint: "Graphite" },
];

/** Three-way appearance control for Settings. */
export function ThemeControl() {
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-[10px] bg-bone p-1 ring-1 ring-ink/8">
      {options.map((o) => {
        const on = pref === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => setTheme(o.id)}
            className={`rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              on ? "bg-ink text-bone" : "text-ash hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
