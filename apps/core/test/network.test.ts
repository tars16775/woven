import { describe, expect, it } from "vitest";
import type { Hardware } from "@woven/hal";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";
import { NetworkScanner, kindOf } from "../src/network-scan.ts";

const hardware: Hardware = {
  paths: { root: "/tmp/x", db: "", store: "", storeTmp: "", keys: "", snapshots: "", logs: "" },
  identity: () => Promise.reject(new Error("not needed")),
  metrics: () => Promise.reject(new Error("not needed")),
  storage: () => Promise.reject(new Error("not needed")),
  network: async () => ({
    gateway: "192.168.0.1",
    interface: "en1",
    ssid: null,
    addresses: ["192.168.0.12"],
    neighbours: [
      { ip: "192.168.0.1", mac: "00:58:28:6c:94:db", name: "modem" },
      { ip: "192.168.0.12", mac: "aa:aa:aa:aa:aa:aa", name: "this-mac" },
      { ip: "192.168.0.9", mac: "42:2f:38:41:aa:2a", name: null },
    ],
    router: false,
  }),
};

describe("network scanner (phase 43)", () => {
  it("merges the hardware layer's view, marks the router, leaves this machine out, and caches", async () => {
    const logger = createLogger(loadConfig({ WOVEN_DATA: "/tmp/x", NODE_ENV: "test", LOG_LEVEL: "fatal" }));
    const scanner = new NetworkScanner(hardware, logger, { mdns: false });
    const view = await scanner.scan();
    expect(view.mode).toBe("observed");
    expect(view.gateway).toBe("192.168.0.1");
    expect(view.neighbours.map((n) => n.ip)).toEqual(["192.168.0.1", "192.168.0.9"]);
    expect(view.neighbours[0]).toMatchObject({ kind: "Router", name: "modem" });
    expect(view.neighbours[1]).toMatchObject({ kind: "Device", name: null });
    expect(await scanner.scan()).toBe(view);
  });
  it("guesses a kind from what a device announces", () => {
    expect(kindOf(["companion-link", "hap"])).toBe("HomeKit accessory");
    expect(kindOf(["meshcop"])).toBe("Thread border router");
    expect(kindOf([])).toBe("Device");
  });
});
