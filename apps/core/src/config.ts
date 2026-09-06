import os from "node:os";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Where a household's data goes when nobody said otherwise: the platform's usual place for an app's data. */
export function defaultDataRoot(): string {
  if (process.platform === "darwin") return join(os.homedir(), "Library", "Application Support", "Woven");
  return join(process.env.XDG_DATA_HOME ?? join(os.homedir(), ".local", "share"), "woven");
}

/** The static site the core serves at "/": next to the bundle in a release (web/), or the export next to the source tree. */
export function defaultSiteDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const c of [join(here, "..", "web"), join(here, "web"), join(here, "..", "..", "web", "out-build"), join(here, "..", "..", "..", "web", "out-build")]) {
    if (existsSync(join(c, "index.html"))) return c;
  }
  return null;
}

/**
 * Runtime configuration, from the environment only. Anything secret lives in
 * the keys directory or the platform keychain, never here.
 */
const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Data root. Defaults to the platform's application-data folder; point it at a bigger drive if you like. */
  WOVEN_DATA: z.string().min(1).default(defaultDataRoot()),
  /** The built dashboard and site to serve at "/". "off" serves the API only. */
  WOVEN_SITE: z.string().default("auto"),
  WOVEN_HOST: z.string().default("0.0.0.0"),
  WOVEN_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Comma-separated origins allowed to call the API from a browser. */
  WOVEN_ORIGINS: z.string().default("http://localhost:3000,https://woven.local:3000,http://woven.local:3000"),
  /** Advertise on the LAN over mDNS as _woven._tcp. */
  WOVEN_MDNS: z.enum(["on", "off"]).default("on"),
  /** The name devices use for the core on the home network. Advertised over mDNS and on the certificate. */
  WOVEN_NAME: z.string().regex(/^[a-z0-9-]+\.local$/i).default("woven.local"),
  /** Serve HTTPS with the household CA. Off only for tests and CI. */
  WOVEN_TLS: z.enum(["on", "off"]).default("on"),
  /** Plain-HTTP port for the trust page that hands devices the household CA. */
  WOVEN_TRUST_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  /** Plain-HTTP copy of the API bound to 127.0.0.1 only, so the dashboard on this same machine works before the CA is trusted. */
  WOVEN_LOCAL_PORT: z.coerce.number().int().min(0).max(65535).default(4002),
  /** The Gate: "spawn" a child process (the Mac), "off", or the URL of a Gate running elsewhere (the box's Outside processor). */
  WOVEN_GATE: z.string().default("spawn"),
  WOVEN_GATE_PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  /** Hosts crossings may reach at first boot, comma-separated; "*.host" allows subdomains. Empty: the owner allows hosts one by one from the dashboard (class H). */
  WOVEN_GATE_ALLOW: z.string().default(""),
  /** A second place for snapshots: another drive, or a folder the household chose. Empty means none yet. */
  WOVEN_SNAPSHOT_MIRROR: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Config = {
  env: "development" | "test" | "production";
  dataRoot: string;
  host: string;
  port: number;
  origins: string[];
  mdns: boolean;
  name: string;
  tls: boolean;
  trustPort: number;
  /** 0 disables the loopback listener. */
  localPort: number;
  gate: { mode: string; port: number; allow: string };
  snapshotMirror: string | null;
  /** Folder with the static site, or null for API only. */
  siteDir: string | null;
  logLevel: z.infer<typeof Env>["LOG_LEVEL"];
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    dataRoot: e.WOVEN_DATA.replace(/\/+$/, ""),
    host: e.WOVEN_HOST,
    port: e.WOVEN_PORT,
    origins: e.WOVEN_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    mdns: e.WOVEN_MDNS === "on",
    name: e.WOVEN_NAME.toLowerCase(),
    tls: e.WOVEN_TLS === "on",
    trustPort: e.WOVEN_TRUST_PORT,
    localPort: e.WOVEN_LOCAL_PORT,
    gate: { mode: e.WOVEN_GATE, port: e.WOVEN_GATE_PORT, allow: e.WOVEN_GATE_ALLOW },
    snapshotMirror: e.WOVEN_SNAPSHOT_MIRROR.trim() || null,
    siteDir: e.WOVEN_SITE === "off" ? null : e.WOVEN_SITE === "auto" ? defaultSiteDir() : e.WOVEN_SITE,
    logLevel: e.LOG_LEVEL,
  };
}
