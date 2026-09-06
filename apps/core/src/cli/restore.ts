/**
 * `pnpm restore <snapshot-dir> [target-data-root]`: restore a snapshot into
 * an empty data root (defaults to WOVEN_DATA). Refuses to overwrite a live
 * database; move it aside first if that is really what you want.
 */
import { storagePaths } from "@woven/hal";
import { loadConfig } from "../config.ts";
import { databasePath } from "../data.ts";
import { restoreSnapshot } from "../snapshot.ts";
import { derive, KeyStore } from "../keystore.ts";

const [snapshotDir, targetRoot] = process.argv.slice(2);
if (!snapshotDir) {
  console.error("usage: pnpm restore <snapshot-dir> [target-data-root]");
  process.exit(2);
}
const config = loadConfig();
const root = targetRoot ?? config.dataRoot;
const paths = storagePaths(root);
// The restored database is encrypted under the key of the data root it goes into (a new one is made if none exists).
const key = await new KeyStore(config.keyStore, paths.keys, root).load();
const manifest = await restoreSnapshot({ snapshotDir, dbPath: databasePath(paths), objectsDir: paths.store, keysDir: paths.keys, key: derive(key, "database") });
console.log(`Restored snapshot from ${manifest.takenAt} into ${root}`);
console.log(`  ${manifest.objects.count} objects, database ${manifest.database.bytes} bytes`);
