import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type KeyStoreMode = "keychain" | "file";

/**
 * The household data key (gap 5): 32 bytes that encrypt the database, every
 * object in the store and the private keys on disk. On a Mac it lives in
 * the login Keychain, so the data folder alone (a stolen drive, a copied
 * image) is unreadable. Elsewhere, or when asked, a file in the keys folder
 * with owner-only permissions stands in until the box's secure element.
 */
export class KeyStore {
  constructor(
    private readonly mode: KeyStoreMode,
    private readonly keysDir: string,
    private readonly dataRoot: string,
  ) {}

  /** Load the key, making one the first time. */
  async load(): Promise<Buffer> {
    if (this.mode === "keychain") {
      const account = `data-${createHash("sha256").update(this.dataRoot).digest("hex").slice(0, 16)}`;
      try {
        const { stdout } = await exec("/usr/bin/security", ["find-generic-password", "-s", "woven", "-a", account, "-w"]);
        const hex = stdout.trim();
        if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, "hex");
      } catch {
        // not there yet
      }
      const key = randomBytes(32);
      await exec("/usr/bin/security", ["add-generic-password", "-s", "woven", "-a", account, "-l", "Woven household data key", "-w", key.toString("hex"), "-U"]);
      return key;
    }
    const file = join(this.keysDir, "data.key");
    try {
      const hex = (await readFile(file, "utf8")).trim();
      if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, "hex");
    } catch {
      // not there yet
    }
    await mkdir(this.keysDir, { recursive: true, mode: 0o700 });
    const key = randomBytes(32);
    await writeFile(file, `${key.toString("hex")}\n`, { mode: 0o600 });
    await chmod(file, 0o600);
    return key;
  }

  static defaultMode(): KeyStoreMode {
    return process.platform === "darwin" ? "keychain" : "file";
  }
}

/** Per-purpose keys from the household key, so the database, objects and private keys never share one. */
export function derive(key: Buffer, purpose: string): Buffer {
  return createHash("sha256").update(key).update(" woven ").update(purpose).digest();
}
