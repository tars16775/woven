import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import type { HardwareIdentity, Metrics } from "@woven/schema";
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
