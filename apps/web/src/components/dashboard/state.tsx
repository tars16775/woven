"use client";

import { useSyncExternalStore } from "react";
import { gate as gateApi, explainAction } from "@/lib/core/actions";
import { coreState, refreshCore, useCore } from "@/lib/core/store";

/**
 * Small shared stores for state that more than one dashboard surface shows
 * (the Gate, scheduled backups). Module-level so pages and the shell agree
 * without a provider; the backend replaces these with live subscriptions.
 */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  return {
    get: () => value,
    set: (next: T | ((v: T) => T)) => {
      value = typeof next === "function" ? (next as (v: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe,
    server: initial,
  };
}

const gate = createStore(true);
const usePreviewGateOpen = () => useSyncExternalStore(gate.subscribe, gate.get, () => gate.server);
/** Whether the Gate is open: the real Gate when a Core is connected, the preview's switch otherwise. */
export function useGateOpen(): boolean {
  const preview = usePreviewGateOpen();
  const core = useCore();
  if (core.phase === "connected" && core.gate) return core.gate.state === "open";
  return preview;
}
/** Open or close the Gate. On a Core this is the gate.set action and leaves a receipt; resolves to an error message or null. */
export async function setGateOpen(open: boolean): Promise<string | null> {
  if (coreState().phase === "connected") {
    try {
      await gateApi.set(open);
      await refreshCore();
      return null;
    } catch (err) {
      return explainAction(err);
    }
  }
  gate.set(open);
  return null;
}


const scheduled = createStore<string[]>([]);
/** Device names whose backup is scheduled for tonight. */
export const useScheduledBackups = () => useSyncExternalStore(scheduled.subscribe, scheduled.get, () => scheduled.server);
export const scheduleBackup = (device: string) =>
  scheduled.set((s) => (s.includes(device) ? s : [...s, device]));

const camerasPaused = createStore(false);
export const useCamerasPaused = () => useSyncExternalStore(camerasPaused.subscribe, camerasPaused.get, () => camerasPaused.server);
export const setCamerasPaused = camerasPaused.set;
