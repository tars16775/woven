/**
 * @woven/hal
 *
 * The one place that knows what machine Woven is running on. The core asks
 * this layer for identity, paths, metrics and features; it never asks the
 * operating system directly. See ADR 0003.
 */
import type { HardwareIdentity, HardwareKind, Metrics, NetworkObservation } from "@woven/schema";
import { genericHardware } from "./generic.ts";
import { macosHardware } from "./macos.ts";

export type { HardwareIdentity, Metrics, NetworkObservation } from "@woven/schema";
export { parseArp, parseRouteGet, parseIpNeigh, parseIpRoute } from "./netparse.ts";

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
  /** The router, this machine's addresses, and who else is on the LAN (ARP). Observed on the Mac; owned on the box. */
  network(): Promise<NetworkObservation>;
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
    case "linux-generic":
      return genericHardware(paths);
    case "linux-box":
      // Phase 49 adds the box implementation (radios, screen, router, temperatures).
      // Until then, asking for the box on a machine that is not one is a configuration error.
      throw new Error(`hardware kind "${kind}" is not implemented yet`);
  }
}
