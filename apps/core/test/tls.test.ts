import { mkdtempSync } from "node:fs";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import Fastify from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { ensureHouseholdTls, openPrivateKey } from "../src/tls.ts";
import { coreDnsNames, lanAddresses } from "../src/network.ts";

const keysDir = mkdtempSync(`${os.tmpdir()}/woven-keys-`);
afterAll(() => rm(keysDir, { recursive: true, force: true }));

async function handshake(port: number, ca: string, servername: string | undefined, host = "127.0.0.1") {
  return new Promise<{ authorized: boolean; error?: string }>((resolve) => {
    const socket = tls.connect({ host, port, ca, ...(servername ? { servername } : {}) }, () => {
      resolve({ authorized: socket.authorized, ...(socket.authorizationError ? { error: String(socket.authorizationError) } : {}) });
      socket.end();
    });
    socket.on("error", (err: Error) => resolve({ authorized: false, error: err.message }));
  });
}

describe("household certificate authority", () => {
  it("creates a CA and a server certificate that a client trusting the CA accepts", async () => {
    const material = await ensureHouseholdTls({ keysDir, dns: ["woven.local", "localhost"], ips: ["192.168.0.12"] });
    expect(material.createdCa).toBe(true);
    expect(material.issued).toBe(true);
    expect(material.ca.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(material.server.dns).toEqual(["woven.local", "localhost"]);
    expect(material.server.ips).toEqual(["127.0.0.1", "192.168.0.12"]);
    expect(((await stat(join(keysDir, "ca.key"))).mode & 0o777).toString(8)).toBe("600");

    const app = Fastify({ https: { key: material.server.keyPem, cert: material.server.certPem }, logger: false });
    app.get("/", async () => ({ ok: true }));
    await app.listen({ host: "127.0.0.1", port: 0 });
    const port = (app.server.address() as { port: number }).port;

    expect(await handshake(port, material.ca.pem, "woven.local")).toEqual({ authorized: true });
    expect(await handshake(port, material.ca.pem, undefined)).toEqual({ authorized: true }); // by IP SAN 127.0.0.1
    const wrongName = await handshake(port, material.ca.pem, "evil.local");
    expect(wrongName.authorized).toBe(false);
    const untrusted = await handshake(port, "", "woven.local");
    expect(untrusted.authorized).toBe(false);
    await app.close();
  });

  it("seals the private keys under the household key and opens them again", async () => {
    const key = Buffer.alloc(32, 5);
    const before = await readFile(join(keysDir, "ca.key"), "utf8");
    expect(before).toMatch(/^-----BEGIN/);
    const sealed = await ensureHouseholdTls({ keysDir, dns: ["woven.local", "localhost"], ips: ["192.168.0.12"], key });
    expect(sealed.createdCa).toBe(false);
    expect(sealed.issued).toBe(false);
    const onDisk = await readFile(join(keysDir, "ca.key"), "utf8");
    expect(onDisk.startsWith("WOVK1\n")).toBe(true);
    expect(onDisk).not.toContain("BEGIN");
    expect(openPrivateKey(onDisk, key)).toBe(before);
    expect(() => openPrivateKey(onDisk, Buffer.alloc(32, 6))).toThrow();
    await expect(ensureHouseholdTls({ keysDir, dns: ["woven.local", "localhost"], ips: ["192.168.0.12"] })).rejects.toThrow(/sealed/);
    // Back to plain for the rest of the suite.
    await writeFile(join(keysDir, "ca.key"), before, { mode: 0o600 });
    await writeFile(join(keysDir, "server.key"), openPrivateKey(await readFile(join(keysDir, "server.key"), "utf8"), key), { mode: 0o600 });
  });

  it("keeps the CA and the certificate when nothing changed", async () => {
    const before = await readFile(join(keysDir, "server.crt"), "utf8");
    const again = await ensureHouseholdTls({ keysDir, dns: ["woven.local", "localhost"], ips: ["192.168.0.12"] });
    expect(again.createdCa).toBe(false);
    expect(again.issued).toBe(false);
    expect(again.server.certPem).toBe(before);
  });

  it("reissues the certificate, under the same CA, when the addresses change or expiry nears", async () => {
    const first = await ensureHouseholdTls({ keysDir, dns: ["woven.local"], ips: [] });
    const moved = await ensureHouseholdTls({ keysDir, dns: ["woven.local"], ips: ["10.0.0.7"] });
    expect(moved.issued).toBe(true);
    expect(moved.createdCa).toBe(false);
    expect(moved.ca.fingerprint).toBe(first.ca.fingerprint);
    expect(moved.server.ips).toContain("10.0.0.7");

    const nearExpiry = new Date(new Date(moved.server.notAfter).getTime() - 10 * 24 * 60 * 60 * 1000);
    const renewed = await ensureHouseholdTls({ keysDir, dns: ["woven.local"], ips: ["10.0.0.7"], now: nearExpiry });
    expect(renewed.issued).toBe(true);
    expect(new Date(renewed.server.notAfter).getTime()).toBeGreaterThan(new Date(moved.server.notAfter).getTime());
  });
});

describe("network names", () => {
  it("always includes the household name and localhost", () => {
    const names = coreDnsNames("Woven.local");
    expect(names[0]).toBe("woven.local");
    expect(names).toContain("localhost");
    expect(names.every((n) => n === "localhost" || n.endsWith(".local"))).toBe(true);
  });
  it("lists only non-loopback IPv4 addresses", () => {
    for (const ip of lanAddresses()) expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(lanAddresses()).not.toContain("127.0.0.1");
  });
});
