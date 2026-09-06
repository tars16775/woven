import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { CORE_HOUSEHOLD_ID, openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-events-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let port: number;

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services: buildServices(data, config, new GateClient(null, "test")), version: "test", startedAt: new Date() });
  await app.listen({ host: "127.0.0.1", port: 0 });
  port = (app.server.address() as { port: number }).port;
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

type Msg = { type: string; row?: { type: string; seq: number }; head?: unknown };

describe("event stream", () => {
  it("greets, then pushes every appended ledger row", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/events`);
    const messages: Msg[] = [];
    const got = (n: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`only ${messages.length} messages`)), 5000);
        socket.addEventListener("message", (ev) => {
          messages.push(JSON.parse(String(ev.data)) as Msg);
          if (messages.length >= n) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    const first = got(2);
    await new Promise<void>((resolve) => socket.addEventListener("open", () => resolve()));
    data.ledger.append({ type: "core.started", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "inside" });
    await first;
    expect(messages[0]?.type).toBe("hello");
    expect(messages[1]).toMatchObject({ type: "ledger", row: { type: "core.started", seq: 1 } });
    socket.close();
    await new Promise<void>((resolve) => socket.addEventListener("close", () => resolve()));
    // The server notices the close a moment later and removes its listener; appending must not throw or leak.
    for (let i = 0; i < 50 && data.ledger.listenerCount("appended") > 0; i += 1) await new Promise((r) => setTimeout(r, 20));
    data.ledger.append({ type: "core.started", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "inside" });
    expect(data.ledger.listenerCount("appended")).toBe(0);
  });

  it("reports config without secrets", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/system/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "woven.local", tls: { enabled: false }, mdns: false });
    expect(JSON.stringify(res.json())).not.toMatch(/PRIVATE KEY/);
  });
});
