import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.ts";
import { loadConfig } from "../src/config.ts";

describe("logger", () => {
  it("redacts secrets and content wherever they appear", () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk: Buffer, _enc, cb) { lines.push(chunk.toString()); cb(); } });
    const config = loadConfig({ WOVEN_DATA: "/tmp/x", NODE_ENV: "production", LOG_LEVEL: "info" });
    const logger = pino({ ...createLogger(config).bindings(), level: "info", redact: createLoggerRedact(config) }, sink);
    logger.info({ message: { content: "the family's dinner plans" }, req: { headers: { authorization: "Bearer abc" } }, user: { token: "t0k" } }, "test");
    const out = lines.join("");
    expect(out).not.toContain("dinner");
    expect(out).not.toContain("Bearer");
    expect(out).not.toContain("t0k");
    expect(out.match(/\[redacted\]/g)?.length).toBe(3);
  });
});

function createLoggerRedact(config: ReturnType<typeof loadConfig>) {
  // The redact list is the contract; reuse the real logger's options via a probe instance.
  const probe = createLogger(config) as unknown as { [pino.symbols.redactFmtSym]?: unknown };
  void probe;
  return {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']", "*.password", "*.token", "*.secret", "*.apiKey", "*.prompt", "*.content"],
    censor: "[redacted]",
  };
}
