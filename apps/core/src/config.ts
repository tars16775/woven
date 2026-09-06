import { z } from "zod";

/**
 * Runtime configuration, from the environment only. Anything secret lives in
 * the keys directory or the platform keychain, never here.
 */
const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Data root. On the Mac: /Volumes/Woven/Woven Data. Required. */
  WOVEN_DATA: z.string().min(1),
  WOVEN_HOST: z.string().default("0.0.0.0"),
  WOVEN_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Comma-separated origins allowed to call the API from a browser. */
  WOVEN_ORIGINS: z.string().default("http://localhost:3000,https://woven.local:3000,http://woven.local:3000"),
  /** Advertise on the LAN over mDNS as _woven._tcp. */
  WOVEN_MDNS: z.enum(["on", "off"]).default("on"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Config = {
  env: "development" | "test" | "production";
  dataRoot: string;
  host: string;
  port: number;
  origins: string[];
  mdns: boolean;
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
    logLevel: e.LOG_LEVEL,
  };
}
