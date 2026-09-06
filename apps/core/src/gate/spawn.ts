import { fork, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger } from "../logger.ts";
import { GateClient } from "./client.ts";

export type GateHandle = { client: GateClient; child: ChildProcess | null; stop(): Promise<void> };

/**
 * Start the Gate as a child process with its own secret, or attach to one
 * already running (WOVEN_GATE=url). The secret never touches disk.
 */
/** `mode` is "spawn", "off", or the URL of a Gate running elsewhere. */
export async function startGate(opts: { mode: string; port: number; allow: string; dataRoot: string; logLevel: string; logger: Logger }): Promise<GateHandle> {
  if (opts.mode === "off") {
    return { client: new GateClient(null, "off"), child: null, stop: async () => undefined };
  }
  const secret = process.env.WOVEN_GATE_SECRET ?? randomBytes(32).toString("base64url");
  if (opts.mode !== "spawn") {
    const client = new GateClient(opts.mode, secret);
    await client.status();
    return { client, child: null, stop: async () => undefined };
  }

  const here = dirname(fileURLToPath(import.meta.url));
  // From source: src/gate/process.ts. Bundled: dist/gate.js next to dist/server.js.
  const entry = [join(here, "process.ts"), join(here, "gate.js")].find((p) => existsSync(p));
  if (!entry) throw new Error("cannot find the Gate entry point");

  const child = fork(entry, [], {
    env: {
      ...process.env,
      WOVEN_DATA: opts.dataRoot,
      WOVEN_GATE_PORT: String(opts.port),
      WOVEN_GATE_SECRET: secret,
      WOVEN_GATE_ALLOW: opts.allow,
      LOG_LEVEL: opts.logLevel,
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the Gate did not start in time")), 20_000);
    child.once("message", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`the Gate exited with code ${String(code)}`));
    });
  });
  child.on("exit", (code) => opts.logger.warn({ code }, "the Gate process exited"));

  const client = new GateClient(`http://127.0.0.1:${opts.port}`, secret);
  await client.status();
  return {
    client,
    child,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 3000).unref();
      }),
  };
}
