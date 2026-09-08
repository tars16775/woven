import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import type { HardwareIdentity, Metrics, NetworkObservation, StorageHealth } from "@woven/schema";
import { parseArp, parseDiskutil, parseRouteGet } from "./netparse.ts";
import type { Hardware, StoragePaths } from "./index.ts";

const exec = promisify(execFile);

async function sysctl(key: string): Promise<string | null> {
  try {
    const { stdout } = await exec("/usr/sbin/sysctl", ["-n", key]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * A stable, non-reversible machine id: the hash of the platform UUID. The
 * UUID itself never leaves this function.
 */
async function machineId(): Promise<string> {
  let seed = os.hostname();
  try {
    const { stdout } = await exec("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
    const m = /"IOPlatformUUID" = "([^"]+)"/.exec(stdout);
    if (m?.[1]) seed = m[1];
  } catch {
    // fall back to the hostname; still stable on one machine
  }
  return createHash("sha256").update(`woven:${seed}`).digest("hex").slice(0, 32);
}

/**
 * macOS reports free memory conservatively because of the file cache. We use
 * the kernel's own accounting via vm_stat where available so "used" means
 * used by processes, not "not free".
 */
async function memoryUsedBytes(): Promise<number> {
  try {
    const { stdout } = await exec("/usr/bin/vm_stat", []);
    const pageSize = Number(/page size of (\d+) bytes/.exec(stdout)?.[1] ?? 16384);
    const read = (label: string) => Number(new RegExp(`${label}:\\s+(\\d+)`).exec(stdout)?.[1] ?? 0);
    const used = read("Pages active") + read("Pages wired down") + read("Pages occupied by compressor");
    return used * pageSize;
  } catch {
    return os.totalmem() - os.freemem();
  }
}

export function macosHardware(paths: StoragePaths): Hardware {
  let identity: HardwareIdentity | null = null;

  return {
    paths,

    // A Mac has a webcam, but not one Woven may claim: capture here means
    // cameras the household pairs to the box, and the radios to find them.
    // Neither exists on this machine, and the dashboard says so rather than
    // showing an empty grid.
    capabilities: { capture: false, radios: false, screen: false },

    async identity() {
      if (identity) return identity;
      const [cpu, model, id] = await Promise.all([
        sysctl("machdep.cpu.brand_string"),
        sysctl("hw.model"),
        machineId(),
      ]);
      identity = {
        kind: "macos",
        machineId: id,
        model: model ?? "Mac",
        memoryBytes: os.totalmem(),
        cpu: cpu ?? os.cpus()[0]?.model ?? "Apple silicon",
        os: `macOS ${os.release()}`,
        features: {
          // No radios until a bridge is paired (phase 25); Wi-Fi is the Mac's own.
          radios: ["wifi", "bluetooth"],
          screen: false,
          router: false,
          gate: "process",
        },
      };
      return identity;
    },

    async network(): Promise<NetworkObservation> {
      let gateway: string | null = null;
      let iface: string | null = null;
      let ssid: string | null = null;
      let neighbours: NetworkObservation["neighbours"] = [];
      try {
        ({ gateway, iface } = parseRouteGet((await exec("/sbin/route", ["-n", "get", "default"])).stdout));
      } catch {
        // no default route: the Mac is offline
      }
      if (iface) {
        try {
          const { stdout } = await exec("/usr/sbin/ipconfig", ["getsummary", iface]);
          ssid = /^\s*SSID\s*:\s*(.+)$/m.exec(stdout)?.[1]?.trim() ?? null;
        } catch {
          ssid = null;
        }
      }
      try {
        neighbours = parseArp((await exec("/usr/sbin/arp", ["-a"])).stdout);
      } catch {
        neighbours = [];
      }
      const addresses = Object.values(os.networkInterfaces())
        .flat()
        .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
        .map((a) => a.address);
      return { gateway, interface: iface, ssid, addresses, neighbours, router: false };
    },

    async storage(): Promise<StorageHealth> {
      const disk = await statfs(paths.root);
      let info: ReturnType<typeof parseDiskutil> = { volume: null, filesystem: null, smart: "unknown", medium: "unknown" };
      try {
        info = parseDiskutil((await exec("/usr/sbin/diskutil", ["info", paths.root])).stdout);
      } catch {
        // not a mounted volume diskutil knows (a plain folder): space only
      }
      return { ...info, usedBytes: (disk.blocks - disk.bfree) * disk.bsize, totalBytes: disk.blocks * disk.bsize, freeBytes: disk.bavail * disk.bsize };
    },

    async metrics() {
      const [used, disk] = await Promise.all([memoryUsedBytes(), statfs(paths.root)]);
      return {
        at: new Date().toISOString(),
        cpuLoad1m: os.loadavg()[0] ?? 0,
        cpuCount: os.cpus().length,
        memoryUsedBytes: used,
        memoryTotalBytes: os.totalmem(),
        diskUsedBytes: (disk.blocks - disk.bfree) * disk.bsize,
        diskTotalBytes: disk.blocks * disk.bsize,
        // Reading the SoC temperature needs root (powermetrics). Report honestly.
        temperatureC: null,
        uptimeSeconds: os.uptime(),
      };
    },
  };
}
