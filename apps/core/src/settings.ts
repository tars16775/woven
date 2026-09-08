import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Settings = {
  /** A second place for snapshots (gap 23): another drive, or a folder the household chose. */
  snapshotMirror: string | null;
  /** The kill switch: "off" survives a restart. */
  power?: "on" | "off";
  powerSince?: string | null;
  powerBy?: string | null;
  /**
   * Every camera stopped at once. One switch for the household rather than
   * one per camera: "are the cameras off?" is a question with a single
   * answer, and it has to survive a restart or it is not an answer.
   */
  camerasPaused?: boolean;
};

/**
 * The few settings a household changes from the dashboard rather than the
 * environment: kept in settings.json in the data root, read at start,
 * written when they change. The environment seeds a value the first time
 * and never overrides a choice made in the dashboard.
 */
export class SettingsStore {
  private readonly file: string;
  private current: Settings;

  constructor(dataRoot: string, seed: Partial<Settings> = {}) {
    this.file = join(dataRoot, "settings.json");
    let saved: Partial<Settings> = {};
    try {
      saved = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Settings>;
    } catch {
      // first start
    }
    // A choice made in the dashboard (even "none") outlives whatever the environment says.
    this.current = { snapshotMirror: "snapshotMirror" in saved ? (saved.snapshotMirror ?? null) : (seed.snapshotMirror ?? null), power: saved.power ?? "on", powerSince: saved.powerSince ?? null, powerBy: saved.powerBy ?? null, camerasPaused: saved.camerasPaused ?? false };
    if (!("snapshotMirror" in saved)) this.save();
  }

  get(): Settings {
    return { ...this.current };
  }

  set(patch: Partial<Settings>): Settings {
    this.current = { ...this.current, ...patch };
    this.save();
    return this.get();
  }

  private save() {
    writeFileSync(this.file, `${JSON.stringify(this.current, null, 2)}\n`, { mode: 0o600 });
  }
}
