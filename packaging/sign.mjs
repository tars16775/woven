#!/usr/bin/env node
// Sign a release file with the Woven release key (Ed25519).
//   WOVEN_RELEASE_KEY="$(cat key.pem)" node packaging/sign.mjs release/woven-macos.tar.gz
// Writes <file>.sig (base64 signature over the file's bytes) and <file>.sha256.
// The private key lives in CI as a secret and in the maintainer's Keychain
// (service woven-release); it is never in the repository.
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const pem = process.env.WOVEN_RELEASE_KEY;
if (!file || !pem) {
  console.error("usage: WOVEN_RELEASE_KEY=<pem> node packaging/sign.mjs <file>");
  process.exit(2);
}
const bytes = readFileSync(file);
const signature = sign(null, bytes, createPrivateKey(pem)).toString("base64");
writeFileSync(`${file}.sig`, `${signature}\n`);
writeFileSync(`${file}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${file.split("/").pop()}\n`);
console.log(`signed ${file}`);
