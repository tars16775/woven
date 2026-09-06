import { TEST_KEY } from "./helpers.ts";
import { mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  const store = new ContentStore(join(root, "store", "objects"), join(root, "store", "tmp"), TEST_KEY);

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

  it("keeps nothing readable on disk and serves byte ranges from the encrypted object", async () => {
    const plain = Buffer.alloc(100_000);
    for (let i = 0; i < plain.length; i += 1) plain[i] = (i * 7 + 3) & 0xff;
    const { sha256 } = await store.put(plain);
    const onDisk = await readFile(store.pathFor(sha256));
    expect(onDisk.subarray(0, 4).toString()).toBe("WOV1");
    expect(onDisk.length).toBe(plain.length + 20);
    expect(onDisk.indexOf(plain.subarray(1000, 1064))).toBe(-1);
    expect(await store.size(sha256)).toBe(plain.length);
    for (const [start, end] of [[0, 15], [13, 40], [4096, 4111], [77_777, 99_999], [16, 16], [50_001, 50_001]] as const) {
      const chunks: Buffer[] = [];
      for await (const c of store.open(sha256, { start, end })) chunks.push(c as Buffer);
      expect(Buffer.concat(chunks).equals(plain.subarray(start, end + 1))).toBe(true);
    }
    const other = new ContentStore(join(root, "store", "objects"), join(root, "store", "tmp"), Buffer.alloc(32, 9));
    expect(await other.verify(sha256)).toBe(false);
  });

  it("encrypts objects written before encryption in place", async () => {
    const bytes = Buffer.from("written by an older core");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(join(store.pathFor(sha256), ".."), { recursive: true });
    await writeFile(store.pathFor(sha256), bytes);
    expect(await store.verify(sha256)).toBe(true); // legacy plain objects still serve
    expect(await store.migratePlain()).toBeGreaterThanOrEqual(1); // this one, plus the corrupted plain object above
    expect((await readFile(store.pathFor(sha256))).subarray(0, 4).toString()).toBe("WOV1");
    expect(await store.verify(sha256)).toBe(true);
    expect(await store.migratePlain()).toBe(0);
  });
});

describe("encrypted database", () => {
  it("cannot be opened without the key and rekeys a plain file on first open", () => {
    const path = join(root, "enc", "woven.sqlite");
    const key = Buffer.alloc(32, 1);
    const plain = openDatabase(path);
    plain.db.insert(households).values({ id: HH, name: "Plain house", createdAt: new Date().toISOString() }).run();
    plain.close();
    const opened = openDatabase(path, key);
    expect(opened.db.select().from(households).all()[0]?.name).toBe("Plain house");
    opened.close();
    expect(() => openDatabase(path)).toThrow(/not a database/);
    expect(() => openDatabase(path, Buffer.alloc(32, 2))).toThrow(/not a database/);
    const again = openDatabase(path, key);
    expect(again.db.select().from(households).all()).toHaveLength(1);
    again.close();
  });
});

describe("snapshot and restore", () => {
  it("round-trips a household into a fresh layout", async () => {
    const dbKey = Buffer.alloc(32, 3);
    const live = openDatabase(join(root, "live", "db", "woven.sqlite"), dbKey);
    live.db.insert(households).values({ id: HH, name: "Test house", createdAt: new Date().toISOString() }).run();
    const store = new ContentStore(join(root, "live", "store", "objects"), join(root, "live", "store", "tmp"), TEST_KEY);
    await store.init();
    const blob = await store.put(Buffer.from("a photo"));

    await mkdir(join(root, "live", "keys"), { recursive: true });
    await writeFile(join(root, "live", "keys", "ca.key"), "sealed");
    const snap = await takeSnapshot({ db: live, objectsDir: join(root, "live", "store", "objects"), snapshotsDir: join(root, "live", "snapshots"), keysDir: join(root, "live", "keys") });
    expect(snap.manifest.objects.count).toBe(1);
    expect(await readFile(join(snap.dir, "keys", "ca.key"), "utf8")).toBe("sealed");
    expect(() => openDatabase(join(snap.dir, "woven.sqlite"))).toThrow(/not a database/); // the snapshot stays encrypted
    expect(JSON.parse(await readFile(join(snap.dir, "manifest.json"), "utf8"))).toMatchObject({ version: 1 });

    const restored = await restoreSnapshot({ snapshotDir: snap.dir, dbPath: join(root, "restored", "db", "woven.sqlite"), objectsDir: join(root, "restored", "store", "objects"), keysDir: join(root, "restored", "keys"), key: dbKey });
    expect(restored.objects.count).toBe(1);
    expect(await readFile(join(root, "restored", "keys", "ca.key"), "utf8")).toBe("sealed");
    const reopened = openDatabase(join(root, "restored", "db", "woven.sqlite"), dbKey);
    expect(reopened.db.select().from(households).all()[0]?.name).toBe("Test house");
    const restoredStore = new ContentStore(join(root, "restored", "store", "objects"), join(root, "restored", "store", "tmp"), TEST_KEY);
    expect(await restoredStore.verify(blob.sha256)).toBe(true);

    // Refuses to clobber a live database.
    await expect(restoreSnapshot({ snapshotDir: snap.dir, dbPath: join(root, "restored", "db", "woven.sqlite"), objectsDir: join(root, "restored", "store", "objects"), key: dbKey })).rejects.toThrow(/refusing/);
    reopened.close();
    live.close();
  });
});
