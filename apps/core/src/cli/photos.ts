/** `pnpm photos <folder> --owner <email>`: import a folder of photos on the box as that person's. */
import { detectHardware } from "@woven/hal";
import { loadConfig } from "../config.ts";
import { openData } from "../data.ts";
import { GateClient } from "../gate/client.ts";
import { buildServices } from "../services.ts";

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const i = args.indexOf("--owner");
const ownerEmail = i >= 0 ? args[i + 1] : undefined;
if (!folder || !ownerEmail) {
  console.error("usage: pnpm photos <folder> --owner <email>");
  process.exit(2);
}
const config = loadConfig();
const { paths } = detectHardware({ dataRoot: config.dataRoot });
const data = await openData(paths);
const services = buildServices(data, config, new GateClient(null, "cli"));
try {
  const owner = services.household.personByEmail(ownerEmail);
  if (!owner) {
    console.error(`No one in the household has the email ${ownerEmail}.`);
    process.exit(2);
  }
  const r = await services.photos.importFolder(owner, folder);
  console.log(`Imported ${r.files} image files, ${r.photos} new photos indexed.`);
} finally {
  data.close();
}
