import { Bonjour, type Service } from "bonjour-service";
import type { Hardware } from "@woven/hal";
import type { NetworkView, Neighbour } from "@woven/schema";
import type { Logger } from "./logger.ts";

/** mDNS service types worth a look, and what a device announcing them most likely is. */
const SERVICES: { type: string; kind: string }[] = [
  { type: "hap", kind: "HomeKit accessory" },
  { type: "matter", kind: "Matter device" },
  { type: "matterc", kind: "Matter device (commissionable)" },
  { type: "meshcop", kind: "Thread border router" },
  { type: "googlecast", kind: "Cast device" },
  { type: "airplay", kind: "AirPlay screen or speaker" },
  { type: "raop", kind: "AirPlay speaker" },
  { type: "spotify-connect", kind: "Speaker" },
  { type: "companion-link", kind: "Apple device" },
  { type: "ipp", kind: "Printer" },
  { type: "printer", kind: "Printer" },
  { type: "smb", kind: "Computer" },
  { type: "ssh", kind: "Computer" },
  { type: "http", kind: "Web device" },
  { type: "woven", kind: "Woven Core" },
];

/**
 * The Network page, honestly (phase 43). On the Mac the Outside is
 * someone else's router: the core reads it, lists who is on the LAN from
 * ARP, and asks mDNS what they are. Nothing is probed or fingerprinted
 * beyond what devices announce about themselves.
 */
export class NetworkScanner {
  private cache: { at: number; view: NetworkView } | null = null;
  private inflight: Promise<NetworkView> | null = null;

  constructor(
    private readonly hardware: Hardware,
    private readonly logger: Logger,
    private readonly opts: { mdns: boolean; browseMs?: number; cacheMs?: number } = { mdns: true },
  ) {}

  scan(): Promise<NetworkView> {
    const cacheMs = this.opts.cacheMs ?? 60_000;
    if (this.cache && Date.now() - this.cache.at < cacheMs) return Promise.resolve(this.cache.view);
    if (this.inflight) return this.inflight;
    this.inflight = this.doScan().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async doScan(): Promise<NetworkView> {
    const [obs, announced] = await Promise.all([this.hardware.network(), this.opts.mdns ? this.browse(this.opts.browseMs ?? 2500) : Promise.resolve(new Map<string, { name: string; services: string[] }>())]);
    const now = new Date().toISOString();
    const byIp = new Map<string, Neighbour>();
    for (const n of obs.neighbours) byIp.set(n.ip, { ip: n.ip, mac: n.mac, name: n.name, kind: n.ip === obs.gateway ? "Router" : "Device", services: [], seenAt: now });
    for (const [ip, a] of announced) {
      const cur = byIp.get(ip) ?? { ip, mac: null, name: null, kind: "Device", services: [], seenAt: now };
      cur.name = cur.name && cur.name !== "?" ? cur.name : a.name;
      cur.services = [...new Set([...cur.services, ...a.services])];
      cur.kind = kindOf(cur.services, cur.kind);
      byIp.set(ip, cur);
    }
    const mine = new Set(obs.addresses);
    const neighbours = [...byIp.values()].filter((n) => !mine.has(n.ip)).sort((a, b) => ipKey(a.ip) - ipKey(b.ip));
    const view: NetworkView = { mode: obs.router ? "owned" : "observed", gateway: obs.gateway, interface: obs.interface, ssid: obs.ssid, addresses: obs.addresses, neighbours, scannedAt: now };
    this.cache = { at: Date.now(), view };
    return view;
  }

  /** Ask for each service type for a moment; collect names and addresses. Errors are just "nothing announced". */
  private browse(ms: number): Promise<Map<string, { name: string; services: string[] }>> {
    return new Promise((resolve) => {
      const found = new Map<string, { name: string; services: string[] }>();
      let bonjour: Bonjour | null = null;
      const browsers: { stop(): void }[] = [];
      try {
        bonjour = new Bonjour();
        for (const s of SERVICES) {
          const b = bonjour.find({ type: s.type }, (svc: Service) => {
            for (const addr of svc.addresses ?? []) {
              if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) continue;
              const cur = found.get(addr) ?? { name: svc.name, services: [] };
              if (!cur.services.includes(s.type)) cur.services.push(s.type);
              found.set(addr, cur);
            }
          });
          browsers.push(b);
        }
      } catch (err) {
        this.logger.warn({ err }, "mDNS browse failed");
      }
      setTimeout(() => {
        for (const b of browsers) {
          try {
            b.stop();
          } catch {}
        }
        try {
          bonjour?.destroy();
        } catch {}
        resolve(found);
      }, ms).unref();
    });
  }
}

export function kindOf(services: string[], fallback = "Device"): string {
  for (const s of SERVICES) if (services.includes(s.type)) return s.kind;
  return fallback;
}

const ipKey = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
