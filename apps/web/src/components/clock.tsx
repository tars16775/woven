"use client";

import { useSyncExternalStore } from "react";

const PLACEHOLDER = "--:--";

// Cached per minute so getSnapshot returns a stable value between renders.
let cachedMinute = -1;
let cachedText = PLACEHOLDER;
function now() {
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== cachedMinute) {
    cachedMinute = minute;
    cachedText = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return cachedText;
}

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

const onServer = () => PLACEHOLDER;

/**
 * Local wall-clock, HH:MM, so the device screen reads as live. The server and
 * the hydrating client both render the placeholder; the real time follows.
 */
export function Clock({ className = "" }: { className?: string }) {
  const t = useSyncExternalStore(subscribe, now, onServer);
  return <span className={className}>{t}</span>;
}
