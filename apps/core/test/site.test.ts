import { mkdtempSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { defaultDataRoot, loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-site-`);
const site = join(dataRoot, "site");
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;

beforeAll(async () => {
  await mkdir(join(site, "dashboard"), { recursive: true });
  await writeFile(join(site, "index.html"), "<h1>home</h1>");
  await writeFile(join(site, "dashboard.html"), "<h1>dashboard</h1>");
  await writeFile(join(site, "dashboard", "files.html"), "<h1>files</h1>");
  await writeFile(join(site, "404.html"), "<h1>lost</h1>");
  const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off", WOVEN_SITE: site });
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services: buildServices(data, config, new GateClient(null, "test")), version: "test", startedAt: new Date() });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("the core serves the site (one process, one address)", () => {
  it("serves pages by path, with and without the .html the export wrote", async () => {
    const html = { accept: "text/html,*/*" };
    expect((await app.inject({ method: "GET", url: "/", headers: html })).body).toContain("home");
    expect((await app.inject({ method: "GET", url: "/dashboard", headers: html })).body).toContain("dashboard");
    expect((await app.inject({ method: "GET", url: "/dashboard/files", headers: html })).body).toContain("files");
    expect((await app.inject({ method: "GET", url: "/dashboard/files.html", headers: html })).body).toContain("files");
  });
  it("answers a page that does not exist with the site's own not-found page, and the API with JSON", async () => {
    const page = await app.inject({ method: "GET", url: "/nowhere", headers: { accept: "text/html" } });
    expect(page.statusCode).toBe(404);
    expect(page.body).toContain("lost");
    const api = await app.inject({ method: "GET", url: "/v1/nowhere", headers: { accept: "text/html" } });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ error: expect.stringMatching(/Nothing at this address/) });
  });
  it("defaults the data root to the platform's application-data folder", () => {
    expect(defaultDataRoot()).toMatch(process.platform === "darwin" ? /Library\/Application Support\/Woven$/ : /woven$/);
    expect(loadConfig({ NODE_ENV: "test" }).dataRoot).toBe(defaultDataRoot());
  });
});
