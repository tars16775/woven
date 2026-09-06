#!/usr/bin/env node
// Make the Woven release signing key, once, on the maintainer's machine.
//   node packaging/keygen.mjs
// Writes packaging/woven-release.pub (commit it: the installer and the Core
// trust this key) and prints the private key ONCE with the two places it
// goes: the login Keychain and the repository secret. It is never written to
// disk by this script.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pubFile = join(here, "woven-release.pub");
if (existsSync(pubFile) && !process.argv.includes("--force")) {
  console.error(`${pubFile} already exists. A new key would orphan every release signed with the old one; pass --force if that is what you want.`);
  process.exit(1);
}
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "pem" });
const pub = publicKey.export({ type: "spki", format: "pem" });
writeFileSync(pubFile, pub);
// The installer carries the public key inline, so `curl | bash` from the repository verifies releases with no extra fetch.
const installer = join(here, "install.sh");
const text = readFileSync(installer, "utf8");
if (text.includes("__WOVEN_RELEASE_PUB__")) writeFileSync(installer, text.replace("__WOVEN_RELEASE_PUB__", pub.trim()));
console.log(`Public key written to ${pubFile} and embedded in packaging/install.sh. Commit both.\n`);
console.log("Private key, shown once. Put it in these two places and nowhere else:\n");
console.log(priv);
console.log(`1. Your login Keychain:\n   security add-generic-password -s woven-release -a key -l "Woven release signing key" -U -w "$(pbpaste)"   # after copying the key\n`);
console.log(`2. The repository secret used by the Release workflow:\n   gh secret set WOVEN_RELEASE_KEY --repo tars16775/woven < key.pem   # if you saved it to a file; delete the file after\n`);
