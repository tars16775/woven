import { mkdtempSync } from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { HardwareIdentity, Metrics } from "@woven/schema";
import { detectHardware, storagePaths } from "../src/index.ts";

describe("@woven/hal", () => {
  it("derives every path from the data root", () => {
    const p = storagePaths("/data");
    expect(p.db).toBe("/data/db");
    expect(p.store).toBe("/data/store/objects");
    expect(p.keys).toBe("/data/keys");
  });

  it.runIf(process.platform === "darwin")("reports a valid identity and metrics on macOS", async () => {
    const root = mkdtempSync(`${os.tmpdir()}/woven-hal-`);
    const hw = detectHardware({ dataRoot: root });
    const id = HardwareIdentity.parse(await hw.identity());
    expect(id.kind).toBe("macos");
    expect(id.machineId).toHaveLength(32);
    expect(id.memoryBytes).toBeGreaterThan(0);
    const m = Metrics.parse(await hw.metrics());
    expect(m.memoryUsedBytes).toBeLessThanOrEqual(m.memoryTotalBytes);
    expect(m.diskTotalBytes).toBeGreaterThan(0);
    expect(m.temperatureC).toBeNull();
  });

  it("reports a valid identity and metrics on any machine through the generic layer", async () => {
    const root = mkdtempSync(`${os.tmpdir()}/woven-hal-`);
    const hw = detectHardware({ dataRoot: root, kind: "linux-generic" });
    const id = HardwareIdentity.parse(await hw.identity());
    expect(id.kind).toBe("linux-generic");
    expect(id.machineId).toHaveLength(32);
    expect(id.features.radios).toEqual([]);
    const m = Metrics.parse(await hw.metrics());
    expect(m.memoryUsedBytes).toBeLessThanOrEqual(m.memoryTotalBytes);
    expect(m.diskTotalBytes).toBeGreaterThan(0);
  });

  it("refuses an unimplemented hardware kind instead of guessing", () => {
    expect(() => detectHardware({ dataRoot: "/tmp", kind: "linux-box" })).toThrow(/not implemented/);
  });
});
