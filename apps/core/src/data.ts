import type { StoragePaths } from "@woven/hal";
import { join } from "node:path";
import { openDatabase, type OpenedDatabase } from "./db/index.ts";
import { Ledger } from "./ledger.ts";
import { ContentStore } from "./store/index.ts";

/**
 * Events the box records about itself before (or outside) any household
 * exist under this id. It is a valid ULID made of zeros so it can never
 * collide with a real household.
 */
export const CORE_HOUSEHOLD_ID = "00000000000000000000000000";

export type Data = {
  database: OpenedDatabase;
  ledger: Ledger;
  store: ContentStore;
  paths: StoragePaths;
  close(): void;
};

/** The database file inside the data root's db folder. */
export function databasePath(paths: StoragePaths): string {
  return join(paths.db, "woven.sqlite");
}

/** Open everything the core keeps on the volume; migrations run here. */
export async function openData(paths: StoragePaths): Promise<Data> {
  const database = openDatabase(databasePath(paths));
  const store = new ContentStore(paths.store, paths.storeTmp);
  await store.init();
  return {
    database,
    ledger: new Ledger(database.db),
    store,
    paths,
    close: () => database.close(),
  };
}
