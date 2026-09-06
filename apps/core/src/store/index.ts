import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, type Dirent } from "node:fs";
import { access, mkdir, open as openFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";

export type PutResult = { sha256: string; size: number; created: boolean };

const MAGIC = Buffer.from("WOV1");
const HEADER = MAGIC.length + 16;

/**
 * The content-addressed store (ADR 0002), encrypted at rest (gap 5). An
 * object is addressed by the SHA-256 of its plain bytes and written once;
 * on disk it is AES-256-CTR under the object key with a random IV in a
 * short header, so a copied drive holds nothing readable. CTR keeps byte
 * ranges cheap (media seeking); integrity comes from the address itself,
 * which `verify` re-checks. Writes go to a temp file and are renamed into
 * place, so a crash never leaves a half object at a real address.
 */
export class ContentStore {
  constructor(
    private readonly objectsDir: string,
    private readonly tmpDir: string,
    private readonly key: Buffer,
  ) {
    if (key.length !== 32) throw new Error("the store key must be 32 bytes");
  }

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
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-ctr", this.key, iv);
    const count = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        size += chunk.length;
        cb(null, cipher.update(chunk));
      },
      flush(cb) {
        cb(null, cipher.final());
      },
    });
    const input: Readable = Buffer.isBuffer(source) ? Readable.from([source]) : source;
    try {
      const out = createWriteStream(tmp, { mode: 0o600 });
      out.write(Buffer.concat([MAGIC, iv]));
      await pipeline(input, count, out);
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

  /** Read an object, or part of one (inclusive plain-byte range) for media seeking. */
  open(sha256: string, range?: { start: number; end: number }): Readable {
    const path = this.pathFor(sha256);
    const key = this.key;
    const start = range?.start ?? 0;
    const end = range?.end;
    const out = new Readable({ read() {} });
    void (async () => {
      const fh = await openFile(path, "r");
      try {
        const head = Buffer.alloc(HEADER);
        const { bytesRead } = await fh.read(head, 0, HEADER, 0);
        if (bytesRead < HEADER || !head.subarray(0, MAGIC.length).equals(MAGIC)) {
          // Written before encryption: plain bytes. Migration encrypts these in place at start.
          const plain = createReadStream(path, { start, ...(end !== undefined ? { end } : {}) });
          for await (const c of plain) out.push(c as Buffer);
          out.push(null);
          return;
        }
        const iv = head.subarray(MAGIC.length, HEADER);
        // CTR: jump the counter to the block the range starts in, then drop the bytes before `start` inside that block.
        const block = Math.floor(start / 16);
        const skip = start % 16;
        const ivAt = Buffer.from(iv);
        let carry = BigInt(block);
        for (let i = 15; i >= 0 && carry > 0n; i -= 1) {
          const v = BigInt(ivAt[i]!) + (carry & 0xffn);
          ivAt[i] = Number(v & 0xffn);
          carry = (carry >> 8n) + (v >> 8n);
        }
        const decipher = createDecipheriv("aes-256-ctr", key, ivAt);
        const fileStart = HEADER + block * 16;
        const fileEnd = end !== undefined ? HEADER + end : undefined;
        const enc = createReadStream(path, { start: fileStart, ...(fileEnd !== undefined ? { end: fileEnd } : {}) });
        let dropped = 0;
        for await (const c of enc) {
          let plain = decipher.update(c as Buffer);
          if (dropped < skip) {
            const d = Math.min(skip - dropped, plain.length);
            plain = plain.subarray(d);
            dropped += d;
          }
          if (plain.length) out.push(plain);
        }
        const tail = decipher.final();
        if (tail.length) out.push(tail);
        out.push(null);
      } catch (err) {
        out.destroy(err as Error);
      } finally {
        await fh.close();
      }
    })();
    return out;
  }

  /**
   * A plain copy in the temp folder for tools that need a file on disk
   * (ffprobe, ffmpeg). The caller removes it with `done` when finished.
   */
  async plainCopy(sha256: string): Promise<{ path: string; done: () => Promise<void> }> {
    const path = join(this.tmpDir, `${randomUUID()}.plain`);
    await pipeline(this.open(sha256), createWriteStream(path, { mode: 0o600 }));
    return { path, done: () => rm(path, { force: true }) };
  }

  async size(sha256: string): Promise<number> {
    const s = await stat(this.pathFor(sha256));
    return (await this.isEncrypted(sha256)) ? s.size - HEADER : s.size;
  }

  private async isEncrypted(sha256: string): Promise<boolean> {
    const fh = await openFile(this.pathFor(sha256), "r");
    try {
      const head = Buffer.alloc(MAGIC.length);
      const { bytesRead } = await fh.read(head, 0, MAGIC.length, 0);
      return bytesRead === MAGIC.length && head.equals(MAGIC);
    } finally {
      await fh.close();
    }
  }

  /** Only the garbage collector calls this, after the database says nothing references the blob. */
  async remove(sha256: string): Promise<void> {
    await rm(this.pathFor(sha256), { force: true });
  }

  /** Decrypt one object and confirm the bytes still match their address. */
  async verify(sha256: string): Promise<boolean> {
    const hash = createHash("sha256");
    try {
      for await (const chunk of this.open(sha256)) hash.update(chunk as Buffer);
    } catch {
      return false;
    }
    return hash.digest("hex") === sha256;
  }

  /** Encrypt in place any object written before encryption arrived. Safe to run at every start; returns how many changed. */
  async migratePlain(onProgress?: (n: number) => void): Promise<number> {
    let n = 0;
    for await (const file of walk(this.objectsDir)) {
      const sha = file.split("/").pop()!;
      if (!/^[a-f0-9]{64}$/.test(sha)) continue;
      if (await this.isEncrypted(sha)) continue;
      const tmp = join(this.tmpDir, randomUUID());
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-ctr", this.key, iv);
      const out = createWriteStream(tmp, { mode: 0o600 });
      out.write(Buffer.concat([MAGIC, iv]));
      await pipeline(createReadStream(file), cipher, out);
      await rename(tmp, file);
      n += 1;
      if (n % 100 === 0) onProgress?.(n);
    }
    return n;
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith("._")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}
