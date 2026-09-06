import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export type PutResult = { sha256: string; size: number; created: boolean };

/**
 * The content-addressed store (ADR 0002). A blob is written once under its
 * SHA-256; writing the same bytes again costs nothing and returns the same
 * address. Writes go to a temp file and are renamed into place, so a crash
 * mid-write never leaves a half object at a real address.
 */
export class ContentStore {
  constructor(
    private readonly objectsDir: string,
    private readonly tmpDir: string,
  ) {}

  async init() {
    await mkdir(this.objectsDir, { recursive: true });
    await mkdir(this.tmpDir, { recursive: true });
  }

  pathFor(sha256: string): string {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("not a sha256");
    return join(this.objectsDir, sha256.slice(0, 2), sha256.slice(2, 4), sha256);
  }

  async has(sha256: string): Promise<boolean> {
    try {
      await access(this.pathFor(sha256));
      return true;
    } catch {
      return false;
    }
  }

  /** Stream bytes in; get the address out. */
  async put(source: Readable | Buffer): Promise<PutResult> {
    const tmp = join(this.tmpDir, randomUUID());
    const hash = createHash("sha256");
    let size = 0;
    const counter = async function* (src: AsyncIterable<Buffer | string>) {
      for await (const chunk of src) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        hash.update(buf);
        size += buf.length;
        yield buf;
      }
    };
    const input: AsyncIterable<Buffer> = Buffer.isBuffer(source) ? Readable.from([source]) : source;
    try {
      await pipeline(counter(input), createWriteStream(tmp, { mode: 0o600 }));
      const sha256 = hash.digest("hex");
      const dest = this.pathFor(sha256);
      if (await this.has(sha256)) {
        await unlink(tmp);
        return { sha256, size, created: false };
      }
      await mkdir(dirname(dest), { recursive: true });
      await rename(tmp, dest);
      return { sha256, size, created: true };
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  open(sha256: string): Readable {
    return createReadStream(this.pathFor(sha256));
  }

  async size(sha256: string): Promise<number> {
    return (await stat(this.pathFor(sha256))).size;
  }

  /** Only the garbage collector calls this, after the database says nothing references the blob. */
  async remove(sha256: string): Promise<void> {
    await rm(this.pathFor(sha256), { force: true });
  }

  /** Re-hash one object and confirm the bytes still match their address. */
  async verify(sha256: string): Promise<boolean> {
    const hash = createHash("sha256");
    try {
      for await (const chunk of this.open(sha256)) hash.update(chunk as Buffer);
    } catch {
      return false;
    }
    return hash.digest("hex") === sha256;
  }
}
