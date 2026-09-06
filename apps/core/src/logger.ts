import pino from "pino";
import type { Config } from "./config.ts";

/**
 * Structured logs that never carry content. Headers that could hold tokens
 * and any field named like a secret are redacted before they are written.
 */
export function createLogger(config: Config) {
  const transport =
    config.env === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } }
      : undefined;
  return pino({
    level: config.logLevel,
    ...(transport ? { transport } : {}),
    base: { service: "woven-core" },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "*.password",
        "*.token",
        "*.secret",
        "*.apiKey",
        "*.prompt",
        "*.content",
      ],
      censor: "[redacted]",
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
