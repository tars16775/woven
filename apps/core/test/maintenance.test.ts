import { mkdtempSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { storagePaths } from "@woven/hal";
import { CORE_HOUSEHOLD_ID, openData } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { loadConfig } from "../src/config.ts";
import { msUntilHour, pruneSnapshots, runNightly } from "../src/maintenance.ts";
import { rm } from "node:fs/promises";

const root = mkdtempSync(`${os.tmpdir()}/woven-maint-`);
afterAll(() => rm(root, { recursive: true, force: true }));

describe("nightly maintenance", () => {
  it("computes the delay to the next run", () => {
    const at = new Date(2026, 8, 5, 22, 30, 0);
    expect(msUntilHour(3, at)).toBe(4.5 * 60 * 60 * 1000);
    expect(msUntilHour(23, at)).toBe(30 * 60 * 1000);
  });

  it("verifies, snapshots and prunes", async () => {
    const paths = storagePaths(root);
    const data = await openData(paths);
    const logger = createLogger(loadConfig({ WOVEN_DATA: root, NODE_ENV: "test", LOG_LEVEL: "fatal" }));
    data.ledger.append({ type: "core.started", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "inside" });
    await data.store.put(Buffer.from("object"));
    // Two stale snapshot folders that should be pruned down to `keep`.
    await mkdir(join(paths.snapshots, "2020-01-01T00-00-00-000Z"), { recursive: true });
    await mkdir(join(paths.snapshots, "2020-01-02T00-00-00-000Z"), { recursive: true });

    await runNightly(data, logger, 2);
    const left = (await readdir(paths.snapshots)).sort();
    expect(left).toHaveLength(2);
    expect(left[0]).toBe("2020-01-02T00-00-00-000Z");
    expect(data.ledger.recent(CORE_HOUSEHOLD_ID, 1)[0]?.type).toBe("core.integrity_checked");
    expect(await pruneSnapshots(paths.snapshots, 1)).toEqual(["2020-01-02T00-00-00-000Z"]);
    data.close();
  });
});
