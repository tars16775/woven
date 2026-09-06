/**
 * `pnpm restore <snapshot-dir> [target-data-root]`: restore a snapshot into
 * an empty data root (defaults to WOVEN_DATA). Refuses to overwrite a live
 * database; move it aside first if that is really what you want.
 */
import { storagePaths } from "@woven/hal";
import { loadConfig } from "../config.ts";
import { databasePath } from "../data.ts";
import { restoreSnapshot } from "../snapshot.ts";

const [snapshotDir, targetRoot] = process.argv.slice(2);
if (!snapshotDir) {
  console.error("usage: pnpm restore <snapshot-dir> [target-data-root]");
  process.exit(2);
}
const root = targetRoot ?? loadConfig().dataRoot;
const paths = storagePaths(root);
const manifest = await restoreSnapshot({ snapshotDir, dbPath: databasePath(paths), objectsDir: paths.store });
console.log(`Restored snapshot from ${manifest.takenAt} into ${root}`);
console.log(`  ${manifest.objects.count} objects, database ${manifest.database.bytes} bytes`);
