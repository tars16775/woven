#!/usr/bin/env node
// Verify a release file against its signature and the Woven release public key.
//   node packaging/verify.mjs <file> <file.sig> <woven-release.pub>
// Exit 0 when the signature checks out, 1 otherwise. The installer runs this
// with the Node it just fetched, before anything from the tarball is used.
import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

const [file, sigFile, pubFile] = process.argv.slice(2);
if (!file || !sigFile || !pubFile) {
  console.error("usage: node packaging/verify.mjs <file> <file.sig> <public-key.pem>");
  process.exit(2);
}
try {
  const ok = verify(null, readFileSync(file), createPublicKey(readFileSync(pubFile, "utf8")), Buffer.from(readFileSync(sigFile, "utf8").trim(), "base64"));
  if (!ok) {
    console.error(`${file}: the signature does not match the Woven release key`);
    process.exit(1);
  }
  console.log(`${file}: signature verified`);
} catch (err) {
  console.error(`${file}: could not verify (${err.message})`);
  process.exit(1);
}
