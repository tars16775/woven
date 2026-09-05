"use client";

import { useSyncExternalStore } from "react";

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
/** Whether the Gate is open. Closed means nothing crosses until reopened. */
export const useGateOpen = () => useSyncExternalStore(gate.subscribe, gate.get, () => gate.server);
export const setGateOpen = gate.set;

const scheduled = createStore<string[]>([]);
/** Device names whose backup is scheduled for tonight. */
export const useScheduledBackups = () => useSyncExternalStore(scheduled.subscribe, scheduled.get, () => scheduled.server);
export const scheduleBackup = (device: string) =>
  scheduled.set((s) => (s.includes(device) ? s : [...s, device]));

const camerasPaused = createStore(false);
export const useCamerasPaused = () => useSyncExternalStore(camerasPaused.subscribe, camerasPaused.get, () => camerasPaused.server);
export const setCamerasPaused = camerasPaused.set;
