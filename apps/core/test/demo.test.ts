import { mkdtempSync } from "node:fs";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { SessionView } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { openData } from "../src/data.ts";
import { TEST_KEY, auth, sessionOf, type Auth } from "./helpers.ts";

/** The demo house: a name is a door. Everywhere else, there is no door. */
async function boot(demo: "on" | "off") {
  const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-demo-`);
  const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_DEMO: demo });
  const hardware = detectHardware({ dataRoot });
  const data = await openData(hardware.paths, { key: TEST_KEY });
  const app = await buildApp({ config, logger: createLogger(config), hardware, data, services: buildServices(data, config, new GateClient(null, "test")), version: "test", startedAt: new Date() });
  await app.ready();
  return { app, data };
}

describe("walking into the demo house", () => {
  let on: Awaited<ReturnType<typeof boot>>;
  let off: Awaited<ReturnType<typeof boot>>;
  let offOwner: Auth = { cookie: "", device: "" };
  beforeAll(async () => {
    [on, off] = await Promise.all([boot("on"), boot("off")]);
    for (const b of [on, off]) {
      const setup = await b.app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "Alex's house", owner: { name: "Alex", email: "alex@example.com" } } });
      if (b === off) offOwner = sessionOf(await b.app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
    }
  });
  afterAll(async () => {
    for (const b of [on, off]) {
      await b.app.close();
      b.data.close();
    }
  });

  it("gives a named visitor a session as a new adult, and the status says it is a demo", async () => {
    const res = await on.app.inject({ method: "POST", url: "/v1/auth/demo", payload: { name: "  Sam " } });
    expect(res.statusCode).toBe(201);
    const view = SessionView.parse(res.json());
    expect(view.method).toBe("demo");
    expect(view.person).toMatchObject({ name: "Sam", role: "adult", email: null });
    expect(view.household.name).toBe("Alex's house");
    const visitor = sessionOf(res);
    const me = await on.app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(visitor) });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ person: { id: string } }>().person.id).toBe(view.person.id);
    expect((await on.app.inject({ method: "GET", url: "/v1/system/status", headers: auth(visitor) })).json<{ demo?: boolean }>().demo).toBe(true);
  });

  it("every visitor is their own person", async () => {
    const a = SessionView.parse((await on.app.inject({ method: "POST", url: "/v1/auth/demo", payload: { name: "Maya" } })).json());
    const b = SessionView.parse((await on.app.inject({ method: "POST", url: "/v1/auth/demo", payload: { name: "Maya" } })).json());
    expect(a.person.id).not.toBe(b.person.id);
    expect(a.person.name).toBe(b.person.name);
  });

  it("refuses an empty name and, on a Core that is not a demo, does not exist", async () => {
    expect((await on.app.inject({ method: "POST", url: "/v1/auth/demo", payload: { name: "   " } })).statusCode).toBe(400);
    expect((await off.app.inject({ method: "POST", url: "/v1/auth/demo", payload: { name: "Sam" } })).statusCode).toBe(404);
    expect((await off.app.inject({ method: "GET", url: "/v1/system/status", headers: auth(offOwner) })).json<{ demo?: boolean }>().demo).toBeUndefined();
  });
});
