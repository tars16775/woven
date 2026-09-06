import { mkdtempSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/index.ts";
import { households } from "../src/db/schema.ts";
import { Ledger, canonicalize } from "../src/ledger.ts";
import { restoreSnapshot, takeSnapshot } from "../src/snapshot.ts";
import { ContentStore } from "../src/store/index.ts";

const root = mkdtempSync(`${os.tmpdir()}/woven-data-`);
const HH = "01J9Z0G0000000000000000001";

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("database", () => {
  it("opens in WAL mode with foreign keys on and applies migrations idempotently", () => {
    const opened = openDatabase(join(root, "db", "woven.sqlite"));
    expect(opened.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(opened.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    const tables = opened.sqlite.prepare("select name from sqlite_master where type='table' order by name").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(["households", "people", "events", "blobs", "files", "sessions", "credentials", "settings"]));
    opened.close();
    // Reopening runs the migrator again and must be a no-op.
    const again = openDatabase(join(root, "db", "woven.sqlite"));
    again.close();
  });
});

describe("ledger", () => {
  const opened = openDatabase(":memory:");
  const ledger = new Ledger(opened.db);

  it("canonicalises JSON so key order cannot change a hash", () => {
    expect(canonicalize({ b: 1, a: { d: [2, { f: 1, e: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"e":2,"f":1}]},"b":1}');
  });

  it("chains rows and verifies the chain", () => {
    const first = ledger.append({ type: "core.started", householdId: HH, actor: { kind: "core", id: "core" }, where: "inside" });
    const second = ledger.append({ type: "action.executed", householdId: HH, actor: { kind: "person", id: "alex" }, where: "device", target: "light.kitchen", payload: { on: false } });
    expect(first.prevHash).toBe("0".repeat(64));
    expect(second.prevHash).toBe(first.hash);
    expect(ledger.verify()).toEqual({ ok: true, rows: 2, head: second.hash });
    expect(ledger.recent(HH)[0]?.id).toBe(second.id);
  });

  it("requires a gate crossing to say what left", () => {
    expect(() => ledger.append({ type: "gate.crossing", householdId: HH, actor: { kind: "person", id: "alex" }, where: "gate" })).toThrow(/what was sent/);
    const ok = ledger.append({ type: "gate.crossing", householdId: HH, actor: { kind: "person", id: "alex" }, where: "gate", sent: "Task text and house size. No names." });
    expect(ok.sent).toMatch(/No names/);
  });

  it("detects tampering with any row", () => {
    opened.sqlite.prepare("update events set payload = ? where seq = 2").run(JSON.stringify({ on: true }));
    const report = ledger.verify();
    expect(report.ok).toBe(false);
    if (!report.ok) expect(report.brokenAtSeq).toBe(2);
  });
});

describe("content store", () => {
  const store = new ContentStore(join(root, "store", "objects"), join(root, "store", "tmp"));

  it("stores once and addresses by hash", async () => {
    await store.init();
    const a = await store.put(Buffer.from("hello woven"));
    const b = await store.put(Readable.from([Buffer.from("hello "), Buffer.from("woven")]));
    expect(a.sha256).toBe(b.sha256);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(a.size).toBe(11);
    expect(await store.has(a.sha256)).toBe(true);
    expect(await store.verify(a.sha256)).toBe(true);
  });

  it("notices a corrupted object", async () => {
    const { sha256 } = await store.put(Buffer.from("fragile"));
    await writeFile(store.pathFor(sha256), "changed");
    expect(await store.verify(sha256)).toBe(false);
  });

  it("rejects addresses that are not hashes", () => {
    expect(() => store.pathFor("../etc/passwd")).toThrow(/sha256/);
  });
});

describe("snapshot and restore", () => {
  it("round-trips a household into a fresh layout", async () => {
    const live = openDatabase(join(root, "live", "db", "woven.sqlite"));
    live.db.insert(households).values({ id: HH, name: "Test house", createdAt: new Date().toISOString() }).run();
    const store = new ContentStore(join(root, "live", "store", "objects"), join(root, "live", "store", "tmp"));
    await store.init();
    const blob = await store.put(Buffer.from("a photo"));

    const snap = await takeSnapshot({ db: live, objectsDir: join(root, "live", "store", "objects"), snapshotsDir: join(root, "live", "snapshots") });
    expect(snap.manifest.objects.count).toBe(1);
    expect(JSON.parse(await readFile(join(snap.dir, "manifest.json"), "utf8"))).toMatchObject({ version: 1 });

    const restored = await restoreSnapshot({ snapshotDir: snap.dir, dbPath: join(root, "restored", "db", "woven.sqlite"), objectsDir: join(root, "restored", "store", "objects") });
    expect(restored.objects.count).toBe(1);
    const reopened = openDatabase(join(root, "restored", "db", "woven.sqlite"));
    expect(reopened.db.select().from(households).all()[0]?.name).toBe("Test house");
    const restoredStore = new ContentStore(join(root, "restored", "store", "objects"), join(root, "restored", "store", "tmp"));
    expect(await restoredStore.verify(blob.sha256)).toBe(true);

    // Refuses to clobber a live database.
    await expect(restoreSnapshot({ snapshotDir: snap.dir, dbPath: join(root, "restored", "db", "woven.sqlite"), objectsDir: join(root, "restored", "store", "objects") })).rejects.toThrow(/refusing/);
    reopened.close();
    live.close();
  });
});
