import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3-multiple-ciphers";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

export type OpenedDatabase = {
  db: Db;
  sqlite: Database.Database;
  path: string;
  close(): void;
};

/**
 * Where the checked-in migrations live. From source this file is
 * src/db/index.ts; bundled it is dist/server.js. Both sit inside the package,
 * so walk up until the migrations journal appears.
 */
function findMigrations(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i += 1) {
    const candidate = join(dir, "drizzle");
    if (existsSync(join(candidate, "meta", "_journal.json"))) return candidate;
    dir = dirname(dir);
  }
  throw new Error("cannot find the drizzle migrations folder next to the core package");
}
const migrationsFolder = findMigrations();

/**
 * Open (or create) the household database and bring it to the current
 * schema. WAL mode for durability with concurrent readers; NORMAL sync is
 * safe under WAL (a crash loses at most the last transaction, never
 * corrupts); foreign keys on; a busy timeout so writers wait instead of fail.
 */
export function openDatabase(path: string, key?: Buffer): OpenedDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  let sqlite = new Database(path);
  if (key && path !== ":memory:") {
    // Encrypted at rest (gap 5). A database written before encryption is rekeyed on first open.
    sqlite.pragma(`key = '${key.toString("hex")}'`);
    try {
      sqlite.prepare("select count(*) from sqlite_master").get();
    } catch {
      sqlite.close();
      sqlite = new Database(path);
      sqlite.prepare("select count(*) from sqlite_master").get(); // plain: readable without a key
      sqlite.pragma("journal_mode = DELETE"); // rekeying needs a rollback journal
      sqlite.pragma(`rekey = '${key.toString("hex")}'`);
      sqlite.close();
      sqlite = new Database(path);
      sqlite.pragma(`key = '${key.toString("hex")}'`);
    }
  }
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("temp_store = MEMORY");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return {
    db,
    sqlite,
    path,
    close() {
      sqlite.close();
    },
  };
}

export { schema };
