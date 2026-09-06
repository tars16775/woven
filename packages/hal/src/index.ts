/**
 * @woven/hal
 *
 * The one place that knows what machine Woven is running on. The core asks
 * this layer for identity, paths, metrics and features; it never asks the
 * operating system directly. See ADR 0003.
 */
import type { HardwareIdentity, HardwareKind, Metrics } from "@woven/schema";
import { macosHardware } from "./macos.ts";

export type { HardwareIdentity, Metrics } from "@woven/schema";

export interface StoragePaths {
  /** The data root, e.g. /Volumes/Woven/Woven Data. */
  root: string;
  db: string;
  store: string;
  storeTmp: string;
  keys: string;
  snapshots: string;
  logs: string;
}

export interface Hardware {
  identity(): Promise<HardwareIdentity>;
  metrics(): Promise<Metrics>;
  paths: StoragePaths;
}

export interface HardwareOptions {
  dataRoot: string;
  /** Force a kind; used in tests and when running the box image in a VM. */
  kind?: HardwareKind;
}

export function storagePaths(root: string): StoragePaths {
  const join = (...p: string[]) => [root, ...p].join("/");
  return {
    root,
    db: join("db"),
    store: join("store", "objects"),
    storeTmp: join("store", "tmp"),
    keys: join("keys"),
    snapshots: join("snapshots"),
    logs: join("logs"),
  };
}

/** Pick the implementation for this machine. */
export function detectHardware(opts: HardwareOptions): Hardware {
  const kind: HardwareKind = opts.kind ?? (process.platform === "darwin" ? "macos" : "linux-generic");
  const paths = storagePaths(opts.dataRoot);
  switch (kind) {
    case "macos":
      return macosHardware(paths);
    case "linux-box":
    case "linux-generic":
      // Phase 49 adds the box and generic Linux implementations. Until then
      // running on Linux is a configuration error, not a silent fallback.
      throw new Error(`hardware kind "${kind}" is not implemented yet`);
  }
}
