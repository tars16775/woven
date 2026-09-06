import { describe, expect, it, vi } from "vitest";
import { CoreClient, CoreError } from "@/lib/core/client";
import { toActivity } from "@/lib/core/activity";
import { defaultCandidates, discover, normalize, probe } from "@/lib/core/discovery";
import { deriveLive, storageLabel } from "@/lib/core/live";
import { disk, gb, uptime } from "@/lib/core/format";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const status = {
  version: "0.1.0",
  startedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  hardware: {
    kind: "macos",
    machineId: "a".repeat(32),
    model: "Mac16,10",
    memoryBytes: 16 * 1024 ** 3,
    cpu: "Apple M4",
    os: "macOS 25.2.0",
    features: { radios: ["wifi"], screen: false, router: false, gate: "process" },
  },
  metrics: {
    at: new Date().toISOString(),
    cpuLoad1m: 1.2,
    cpuCount: 10,
    memoryUsedBytes: 7.5 * 1024 ** 3,
    memoryTotalBytes: 16 * 1024 ** 3,
    diskUsedBytes: 312e9,
    diskTotalBytes: 994e9,
    temperatureC: null,
    uptimeSeconds: 99999,
  },
  gate: "absent",
  dataRoot: "/Volumes/Woven/Woven Data",
};

describe("discovery", () => {
  it("normalises what a person types into a core address", () => {
    expect(normalize("woven.local")).toBe("https://woven.local:4000");
    expect(normalize("192.168.1.20")).toBe("https://192.168.1.20:4000");
    expect(normalize("http://localhost:4002/")).toBe("http://localhost:4002");
    expect(normalize(" HTTPS://box.local:4000 ")).toBe("HTTPS://box.local:4000");
  });

  it("tries the household name first and includes the loopback listener", () => {
    const c = defaultCandidates();
    expect(c[0]).toBe("https://woven.local:4000");
    expect(c).toContain("http://localhost:4002");
  });

  it("accepts only a real Woven health answer", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.startsWith("https://woven.local")) throw new TypeError("Failed to fetch");
      if (u.startsWith("http://localhost:4002")) return json({ ok: true, version: "0.1.0" });
      return json({ hello: "world" });
    }) as unknown as typeof fetch;
    expect(await probe("https://woven.local:4000", 1000, fetcher)).toEqual({ ok: false, reason: "unreachable" });
    expect(await probe("http://other:4000", 1000, fetcher)).toEqual({ ok: false, reason: "not a Woven Core" });
    expect(await discover(["https://woven.local:4000", "http://other:4000", "http://localhost:4002"], fetcher)).toBe("http://localhost:4002");
    expect(await discover(["https://woven.local:4000"], fetcher)).toBeNull();
  });
});

describe("client", () => {
  it("parses status against the shared schema and rejects a bad shape", async () => {
    const good = new CoreClient("http://core", (async () => json(status)) as unknown as typeof fetch);
    expect((await good.status()).hardware.model).toBe("Mac16,10");
    const bad = new CoreClient("http://core", (async () => json({ version: 1 })) as unknown as typeof fetch);
    await expect(bad.status()).rejects.toThrow();
    const down = new CoreClient("http://core", (async () => json({ error: "Nothing at this address on the box." }, 404)) as unknown as typeof fetch);
    await expect(down.status()).rejects.toBeInstanceOf(CoreError);
    expect(good.eventsUrl()).toBe("ws://core/v1/events");
  });
});

describe("live values", () => {
  it("shows the machine's real numbers when connected and the preview otherwise", () => {
    const live = deriveLive({ phase: "connected", url: "http://localhost:4002", version: "0.1.0", status: status as never, config: null, gate: null, rows: [], since: 0 });
    expect(live.connected).toBe(true);
    expect(live.host).toBe("localhost");
    expect(live.version).toBe("Woven Core 0.1.0");
    expect(live.memory).toEqual({ used: 7.5, total: 16, unit: "GB" });
    expect(live.storage).toMatchObject({ used: "312", usedUnit: "GB", total: "994", unit: "GB" });
    const mixed = deriveLive({ phase: "connected", url: "http://localhost:4002", version: "0.1.0", status: { ...status, metrics: { ...status.metrics, diskUsedBytes: 4.37e9, diskTotalBytes: 1.61e12 } } as never, config: null, gate: null, rows: [], since: 0 });
    expect(mixed.storage).toMatchObject({ used: "4", usedUnit: "GB", total: "1.6", unit: "TB" });
    expect(storageLabel(mixed)).toBe("4 GB / 1.6 TB");
    expect(storageLabel(live)).toBe("312 / 994 GB");
    expect(live.temperatureC).toBeNull();
    expect(live.uptime).toBe("3 h");

    const preview = deriveLive({ phase: "unreachable", tried: [], reason: "no answer" });
    expect(preview.connected).toBe(false);
    expect(preview.version).toMatch(/Woven OS/);
  });

  it("formats units the way the operating system does", () => {
    expect(gb(16 * 1024 ** 3)).toBe("16");
    expect(disk(2e12)).toEqual({ value: "2", unit: "TB" });
    expect(disk(1.25e12)).toEqual({ value: "1.3", unit: "TB" });
    expect(disk(994e9)).toEqual({ value: "994", unit: "GB" });
    expect(uptime(30)).toBe("just now");
    expect(uptime(15 * 60)).toBe("15 min");
    expect(uptime(5 * 86400)).toBe("5 days");
  });
});

describe("ledger rows on the Activity page", () => {
  it("reads as a receipt: what, who, where, what left", () => {
    const now = new Date();
    const row = {
      id: "01J9Z0G0000000000000000001",
      type: "gate.crossing" as const,
      occurredAt: now.toISOString(),
      householdId: "01J9Z0G0000000000000000002",
      actor: { kind: "person" as const, id: "alex" },
      where: "gate" as const,
      sensitivity: "normal" as const,
      payload: {},
      sent: "Task text and house size. No names.",
      seq: 12,
      prevHash: "0".repeat(64),
      hash: "ab".repeat(32),
    };
    const item = toActivity(row, now);
    expect(item).toMatchObject({ title: "Crossing", where: "cloud", actor: "person alex", day: "today", seq: 12 });
    expect(item.sent).toMatch(/No names/);
    const check = toActivity({ ...row, type: "core.integrity_checked", where: "inside", actor: { kind: "core", id: "core" }, payload: { ok: true, rows: 40 } }, now);
    expect(check).toMatchObject({ title: "Ledger verified", detail: "40 rows, chain intact", where: "local", actor: "the Core" });
  });
});
