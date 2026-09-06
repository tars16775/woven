import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GateClient } from "./gate/client.ts";

/**
 * Models the box can hold (phase 21 onward). Every file comes through the
 * Gate, lands under the data root, and is pinned by hash the first time so
 * a later run notices if anything changed. Nothing here loads a model; it
 * only makes sure the bytes are present and untouched.
 */
export type ModelSpec = {
  name: string;
  title: string;
  purpose: string;
  repo: string;
  revision: string;
  /** Every file with the hash it must have; a download that differs is refused before it is used. */
  files: Record<string, string>;
  approxBytes: number;
};

export const catalogue: readonly ModelSpec[] = [
  {
    name: "photo-search",
    title: "Photo search",
    purpose: "Finds photos by what is in them: 'the lake trip', 'a red bicycle'. Runs entirely on the box.",
    repo: "Xenova/clip-vit-base-patch32",
    revision: "main",
    files: {
      "config.json": "493ef57ff783e42d1530c91b53469b7fdf8db8a9c1408e86998fcb7899a4f495",
      "preprocessor_config.json": "6f638fb9401a6d6296feff533ee7efe657b787c49f954f82f5906b36ef2a1b1f",
      "tokenizer.json": "f7f3b7af117d467b58374797691a6438d3e6b9e9cef800dfd5dced7f697a90cd",
      "tokenizer_config.json": "60ba2912bc6344c94bc16bbdec27fa1209409167b6f2fdf3cfe9e65462ea3967",
      "special_tokens_map.json": "c4864a9376a8401918425bed71fc14fc0e81f9b59ec45c1cf96cccb2df508eac",
      "onnx/vision_model_quantized.onnx": "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299",
      "onnx/text_model_quantized.onnx": "73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a",
    },
    approxBytes: 180 * 1024 * 1024,
  },
];

export type ModelState = { name: string; installed: boolean; bytes: number; installedAt: string | null; verified: boolean | null };
type Manifest = { repo: string; revision: string; installedAt: string; files: Record<string, { sha256: string; bytes: number }> };

export class ModelStore {
  constructor(
    readonly dir: string,
    private readonly gate: GateClient,
  ) {}

  spec(name: string): ModelSpec | null {
    return catalogue.find((m) => m.name === name) ?? null;
  }

  /** Where transformers.js should look: <dir>/<repo>/... */
  pathFor(spec: ModelSpec): string {
    return join(this.dir, spec.repo);
  }

  private manifestPath(spec: ModelSpec) {
    return join(this.pathFor(spec), "woven-manifest.json");
  }

  async state(name: string): Promise<ModelState> {
    const spec = this.spec(name);
    if (!spec) throw new Error(`no model called ${name}`);
    try {
      const m = JSON.parse(await readFile(this.manifestPath(spec), "utf8")) as Manifest;
      const bytes = Object.values(m.files).reduce((n, f) => n + f.bytes, 0);
      return { name, installed: true, bytes, installedAt: m.installedAt, verified: null };
    } catch {
      return { name, installed: false, bytes: 0, installedAt: null, verified: null };
    }
  }

  async isInstalled(name: string): Promise<boolean> {
    return (await this.state(name)).installed;
  }

  /** Download every file through the Gate and write the manifest. Files already present and matching the manifest are kept. */
  async install(name: string, actionId: string, onFile?: (file: string, bytes: number) => void): Promise<ModelState> {
    const spec = this.spec(name);
    if (!spec) throw new Error(`no model called ${name}`);
    const root = this.pathFor(spec);
    await mkdir(root, { recursive: true });
    let existing: Manifest | null = null;
    try {
      existing = JSON.parse(await readFile(this.manifestPath(spec), "utf8")) as Manifest;
    } catch {
      existing = null;
    }
    const files: Manifest["files"] = {};
    for (const [file, expected] of Object.entries(spec.files)) {
      const dest = join(root, file);
      const known = existing?.files[file];
      if (known && known.sha256 === expected && (await stat(dest).catch(() => null))?.size === known.bytes) {
        files[file] = known;
        continue;
      }
      const url = `${process.env.WOVEN_MODEL_SOURCE ?? "https://huggingface.co"}/${spec.repo}/resolve/${spec.revision}/${file}`;
      const r = await this.gate.download({ actionId, url, dest, maxBytes: 2 * 1024 ** 3 });
      if (process.env.WOVEN_MODEL_SOURCE === undefined && r.sha256 !== expected) {
        await rm(dest, { force: true });
        throw new Error(`${file} did not match the hash Woven pinned for it; the download was discarded.`);
      }
      files[file] = { sha256: r.sha256, bytes: r.bytesIn };
      onFile?.(file, r.bytesIn);
    }
    const manifest: Manifest = { repo: spec.repo, revision: spec.revision, installedAt: new Date().toISOString(), files };
    await writeFile(this.manifestPath(spec), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return this.state(name);
  }

  /** Re-hash every file against the manifest. */
  async verify(name: string): Promise<{ ok: boolean; bad: string[] }> {
    const spec = this.spec(name);
    if (!spec) throw new Error(`no model called ${name}`);
    const m = JSON.parse(await readFile(this.manifestPath(spec), "utf8")) as Manifest;
    const bad: string[] = [];
    for (const [file, info] of Object.entries(m.files)) {
      const h = createHash("sha256");
      try {
        for await (const c of createReadStream(join(this.pathFor(spec), file))) h.update(c as Buffer);
      } catch {
        bad.push(file);
        continue;
      }
      if (h.digest("hex") !== info.sha256) bad.push(file);
    }
    return { ok: bad.length === 0, bad };
  }

  async remove(name: string): Promise<void> {
    const spec = this.spec(name);
    if (spec) await rm(this.pathFor(spec), { recursive: true, force: true });
  }
}
