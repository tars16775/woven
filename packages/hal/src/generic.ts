import { createHash } from "node:crypto";
import { readFile, statfs } from "node:fs/promises";
import os from "node:os";
import type { HardwareIdentity, HardwareKind, Metrics, NetworkObservation } from "@woven/schema";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseIpNeigh, parseIpRoute } from "./netparse.ts";

const exec = promisify(execFile);
import type { Hardware, StoragePaths } from "./index.ts";

/**
 * Any Linux machine that is not the Woven box: a mini PC, a VM, a CI runner.
 * Everything comes from Node's os module and /etc/machine-id, nothing from
 * vendor tools, so it runs anywhere. The box implementation (phase 49) adds
 * radios, the screen, temperatures and the router on top of this.
 */
export function genericHardware(paths: StoragePaths, kind: HardwareKind = "linux-generic"): Hardware {
  let identity: HardwareIdentity | null = null;

  return {
    paths,

    async identity() {
      if (identity) return identity;
      let seed = os.hostname();
      try {
        seed = (await readFile("/etc/machine-id", "utf8")).trim() || seed;
      } catch {
        // No machine-id (containers, BSDs): the hostname is still stable on one machine.
      }
      identity = {
        kind,
        machineId: createHash("sha256").update(`woven:${seed}`).digest("hex").slice(0, 32),
        model: await readModel(),
        memoryBytes: os.totalmem(),
        cpu: os.cpus()[0]?.model.trim() ?? os.arch(),
        os: `${os.type()} ${os.release()}`,
        features: { radios: [], screen: false, router: false, gate: "process" },
      };
      return identity;
    },

    async network(): Promise<NetworkObservation> {
      let gateway: string | null = null;
      let iface: string | null = null;
      let neighbours: NetworkObservation["neighbours"] = [];
      try {
        ({ gateway, iface } = parseIpRoute((await exec("ip", ["route", "show", "default"])).stdout));
        neighbours = parseIpNeigh((await exec("ip", ["neigh"])).stdout);
      } catch {
        // no iproute2 (a container, a BSD): nothing to report
      }
      const addresses = Object.values(os.networkInterfaces())
        .flat()
        .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
        .map((a) => a.address);
      return { gateway, interface: iface, ssid: null, addresses, neighbours, router: false };
    },

    async metrics() {
      const disk = await statfs(paths.root);
      return {
        at: new Date().toISOString(),
        cpuLoad1m: os.loadavg()[0] ?? 0,
        cpuCount: os.cpus().length,
        memoryUsedBytes: await memoryUsedBytes(),
        memoryTotalBytes: os.totalmem(),
        diskUsedBytes: (disk.blocks - disk.bfree) * disk.bsize,
        diskTotalBytes: disk.blocks * disk.bsize,
        temperatureC: await thermal(),
        uptimeSeconds: os.uptime(),
      };
    },
  };
}

async function readModel(): Promise<string> {
  for (const p of ["/sys/devices/virtual/dmi/id/product_name", "/proc/device-tree/model"]) {
    try {
      const v = (await readFile(p, "utf8")).replace(/\0/g, "").trim();
      if (v) return v.slice(0, 120);
    } catch {
      // try the next source
    }
  }
  return `${os.type()} ${os.arch()}`;
}

/** Linux counts cache as free in MemAvailable; use that when present so "used" means used. */
async function memoryUsedBytes(): Promise<number> {
  try {
    const info = await readFile("/proc/meminfo", "utf8");
    const kb = (label: string) => Number(new RegExp(`^${label}:\\s+(\\d+)`, "m").exec(info)?.[1] ?? NaN);
    const total = kb("MemTotal");
    const available = kb("MemAvailable");
    if (Number.isFinite(total) && Number.isFinite(available)) return (total - available) * 1024;
  } catch {
    // not Linux
  }
  return os.totalmem() - os.freemem();
}

/** The first thermal zone that reports, in °C; null where none does. */
async function thermal(): Promise<number | null> {
  for (let i = 0; i < 4; i += 1) {
    try {
      const milli = Number((await readFile(`/sys/class/thermal/thermal_zone${i}/temp`, "utf8")).trim());
      if (Number.isFinite(milli) && milli > 0) return Math.round(milli / 100) / 10;
    } catch {
      break;
    }
  }
  return null;
}
