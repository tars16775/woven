/** `pnpm snapshot`: take a snapshot of the household now. */
import { detectHardware } from "@woven/hal";
import { loadConfig } from "../config.ts";
import { openData } from "../data.ts";
import { takeSnapshot } from "../snapshot.ts";

const config = loadConfig();
const { paths } = detectHardware({ dataRoot: config.dataRoot });
const data = await openData(paths);
try {
  const { dir, manifest } = await takeSnapshot({ db: data.database, objectsDir: paths.store, snapshotsDir: paths.snapshots });
  console.log(`Snapshot written to ${dir}`);
  console.log(`  database ${manifest.database.bytes} bytes, ${manifest.objects.count} objects (${manifest.objects.bytes} bytes)`);
} finally {
  data.close();
}
