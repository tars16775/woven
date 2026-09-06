import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";
import { ensureHouseholdTls } from "../src/tls.ts";
import { buildTrustServer } from "../src/trust.ts";

const keysDir = mkdtempSync(`${os.tmpdir()}/woven-trust-`);
afterAll(() => rm(keysDir, { recursive: true, force: true }));

describe("trust page", () => {
  it("hands out the CA, its fingerprint and a QR code, and nothing else", async () => {
    const tls = await ensureHouseholdTls({ keysDir, dns: ["woven.local"], ips: [] });
    const logger = createLogger(loadConfig({ WOVEN_DATA: keysDir, NODE_ENV: "test", LOG_LEVEL: "fatal" }));
    const app = await buildTrustServer({ logger, tls, version: "test", trustUrl: "http://woven.local:4001", coreUrl: "https://woven.local:4000/v1/health" });

    const ca = await app.inject({ method: "GET", url: "/ca.crt" });
    expect(ca.statusCode).toBe(200);
    expect(ca.headers["content-type"]).toBe("application/x-x509-ca-cert");
    expect(ca.body).toBe(tls.ca.pem);

    const json = await app.inject({ method: "GET", url: "/trust.json" });
    expect(json.json()).toMatchObject({ fingerprint: tls.ca.fingerprint, caUrl: "http://woven.local:4001/ca.crt" });

    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("<svg");
    expect(page.body).toContain(tls.ca.fingerprint);
    expect(page.headers["cache-control"]).toBe("no-store");

    expect((await app.inject({ method: "GET", url: "/v1/ledger/recent" })).statusCode).toBe(404);
    await app.close();
  });
});
