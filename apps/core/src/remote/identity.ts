import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openPrivateKey, sealPrivateKey } from "../tls.ts";

export type RelayIdentity = {
  /** 32 hex characters from the public key: the address dashboards use at the relay. */
  coreId: string;
  pubDer: Buffer;
  sign: (message: Buffer) => Buffer;
};

/**
 * The Core's identity at the relay (gap 21): an Ed25519 key in keys/,
 * sealed under the household key like the CA. The relay only ever sees
 * the public half; the id is a hash of it.
 */
export async function relayIdentity(keysDir: string, sealKey: Buffer | undefined): Promise<RelayIdentity> {
  const file = join(keysDir, "relay.key");
  let priv: KeyObject;
  try {
    priv = createPrivateKey(openPrivateKey(await readFile(file, "utf8"), sealKey));
  } catch {
    const pair = generateKeyPairSync("ed25519");
    priv = pair.privateKey;
    await mkdir(keysDir, { recursive: true, mode: 0o700 });
    await writeFile(file, sealPrivateKey(priv.export({ type: "pkcs8", format: "pem" }) as string, sealKey), { mode: 0o600 });
  }
  const pubDer = createPublicKey(priv).export({ type: "spki", format: "der" });
  return {
    coreId: createHash("sha256").update(pubDer).digest("hex").slice(0, 32),
    pubDer,
    sign: (message) => sign(null, message, priv),
  };
}
