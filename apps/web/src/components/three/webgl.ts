"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | null = null;

/** Whether the browser can hand out a WebGL context. Decided once, on the client. */
export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

const subscribe = () => () => {};
const onServer = () => null;

/**
 * WebGL availability as a render-safe value: `null` on the server and during
 * hydration, then `true`/`false` on the client without a state update.
 */
export function useWebGL(): boolean | null {
  return useSyncExternalStore(subscribe, webglAvailable, onServer);
}
