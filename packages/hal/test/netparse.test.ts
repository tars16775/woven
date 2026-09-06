import { describe, expect, it } from "vitest";
import { normaliseMac, parseArp, parseDiskutil, parseIpNeigh, parseIpRoute, parseRouteGet } from "../src/netparse.ts";

describe("network parsers", () => {
  it("reads the macOS default route", () => {
    expect(parseRouteGet("   route to: default\ndestination: default\n    gateway: 192.168.0.1\n  interface: en1\n")).toEqual({ gateway: "192.168.0.1", iface: "en1" });
    expect(parseRouteGet("route: writing to routing socket: not in table")).toEqual({ gateway: null, iface: null });
  });
  it("reads the macOS ARP table and drops broadcast and incomplete rows", () => {
    const out = "modem (192.168.0.1) at 0:58:28:6c:94:db on en1 ifscope [ethernet]\n? (192.168.0.9) at 42:2f:38:41:aa:2a on en1 ifscope [ethernet]\n? (192.168.0.255) at ff:ff:ff:ff:ff:ff on en1 ifscope [ethernet]\nghost (192.168.0.50) at (incomplete) on en1 ifscope [ethernet]\n";
    expect(parseArp(out)).toEqual([
      { ip: "192.168.0.1", mac: "00:58:28:6c:94:db", name: "modem" },
      { ip: "192.168.0.9", mac: "42:2f:38:41:aa:2a", name: null },
    ]);
  });
  it("reads iproute2 output on Linux", () => {
    expect(parseIpRoute("default via 10.0.0.1 dev eth0 proto dhcp metric 100\n")).toEqual({ gateway: "10.0.0.1", iface: "eth0" });
    expect(parseIpNeigh("10.0.0.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n10.0.0.7 dev eth0  FAILED\n")).toEqual([{ ip: "10.0.0.1", mac: "aa:bb:cc:dd:ee:ff", name: null }]);
  });
  it("normalises MACs", () => {
    expect(normaliseMac("0:1:2:A:B:C")).toBe("00:01:02:0a:0b:0c");
    expect(normaliseMac("nope")).toBeNull();
  });

  it("reads diskutil health lines", () => {
    expect(parseDiskutil("   Volume Name:               Woven\n   File System Personality:   APFS\n   SMART Status:              Not Supported\n   Solid State:               Info not available\n")).toEqual({ volume: "Woven", filesystem: "APFS", smart: "unknown", medium: "unknown" });
    expect(parseDiskutil("   SMART Status:              Verified\n   Solid State:               Yes\n")).toMatchObject({ smart: "verified", medium: "ssd" });
    expect(parseDiskutil("   SMART Status:              Failing\n")).toMatchObject({ smart: "failing" });
  });
});
