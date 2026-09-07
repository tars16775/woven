"use client";

import { disk, gb, hostOf, uptime } from "./format";
import { useCore, type CoreState } from "./store";

/**
 * What the shell, Overview and Core page show about the machine. It only ever
 * describes a Core that answered. There is no sample machine behind it: with
 * nothing connected every field is blank and the shell says so.
 */
export type LiveCore = {
  connected: boolean;
  phase: CoreState["phase"];
  host: string | null;
  /** "Woven Core 0.1.0", or "Woven" when nothing has answered. */
  version: string;
  model: string;
  cpu: string | null;
  os: string | null;
  memory: { used: number; total: number; unit: "GB" };
  storage: { used: string; usedUnit: "GB" | "TB"; total: string; unit: "GB" | "TB"; usedBytes: number; totalBytes: number };
  /** null when the platform does not report a temperature. */
  temperatureC: number | null;
  fan: string;
  uptime: string;
  gate: "open" | "closed" | "absent";
  dataRoot: string | null;
};

export function deriveLive(state: CoreState): LiveCore {
  if (state.phase === "connected" && state.status) {
    const { status } = state;
    const used = disk(status.metrics.diskUsedBytes);
    const total = disk(status.metrics.diskTotalBytes);
    return {
      connected: true,
      phase: state.phase,
      host: state.remote ? "away, via the relay" : hostOf(state.url),
      version: `Woven Core ${status.version}`,
      model: status.hardware.model,
      cpu: status.hardware.cpu,
      os: status.hardware.os,
      memory: { used: Number(gb(status.metrics.memoryUsedBytes)), total: Math.round(status.metrics.memoryTotalBytes / 1024 ** 3), unit: "GB" },
      storage: { used: used.value, usedUnit: used.unit, total: total.value, unit: total.unit, usedBytes: status.metrics.diskUsedBytes, totalBytes: status.metrics.diskTotalBytes },
      temperatureC: status.metrics.temperatureC,
      fan: status.metrics.temperatureC === null ? "not reported" : "quiet",
      uptime: uptime(Math.max(0, (Date.now() - new Date(status.startedAt).getTime()) / 1000)),
      gate: status.gate,
      dataRoot: status.dataRoot,
    };
  }
  if (state.phase === "connected") {
    // Connected, status not in yet: blanks, never a borrowed number (gap 12).
    return {
      connected: true,
      phase: state.phase,
      host: hostOf(state.url),
      version: `Woven Core ${state.version}`,
      model: "…",
      cpu: null,
      os: null,
      memory: { used: 0, total: 0, unit: "GB" },
      storage: { used: "…", usedUnit: "GB", total: "…", unit: "GB", usedBytes: 0, totalBytes: 0 },
      temperatureC: null,
      fan: "…",
      uptime: "…",
      gate: state.gate?.state ?? "absent",
      dataRoot: null,
    };
  }
  // Nothing answered. Nothing is known, so nothing is claimed.
  return {
    connected: false,
    phase: state.phase,
    host: null,
    version: "Woven",
    model: "No Core",
    cpu: null,
    os: null,
    memory: { used: 0, total: 0, unit: "GB" },
    storage: { used: "—", usedUnit: "GB", total: "—", unit: "GB", usedBytes: 0, totalBytes: 0 },
    temperatureC: null,
    fan: "—",
    uptime: "—",
    gate: "absent",
    dataRoot: null,
  };
}

export function useLiveCore(): LiveCore {
  return deriveLive(useCore());
}

/** "38 / 64 GB" */
export function memoryLabel(l: LiveCore) {
  if (!l.connected) return "—";
  return `${l.memory.used} / ${l.memory.total} ${l.memory.unit}`;
}
/** "1.2 / 2 TB", "312 / 994 GB", or "4 GB / 1.6 TB" when the units differ. */
export function storageLabel(l: LiveCore) {
  if (!l.connected) return "—";
  const { used, usedUnit, total, unit } = l.storage;
  return usedUnit === unit ? `${used} / ${total} ${unit}` : `${used} ${usedUnit} / ${total} ${unit}`;
}
/** "4 GB" */
export function storageUsedLabel(l: LiveCore) {
  return l.connected ? `${l.storage.used} ${l.storage.usedUnit}` : "—";
}
export function temperatureLabel(l: LiveCore) {
  return l.temperatureC === null ? "—" : `${l.temperatureC} °C`;
}
