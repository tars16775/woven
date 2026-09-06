import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import { MediaItem, type Namespace, type Person } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./db/index.ts";
import { files, media } from "./db/schema.ts";
import type { HouseholdService } from "./household.ts";
import type { ContentStore } from "./store/index.ts";
import type { Logger } from "./logger.ts";

const exec = promisify(execFile);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo", "video/mpeg"]);
const AUDIO_MIMES = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/x-wav", "audio/flac", "audio/ogg", "audio/webm", "audio/x-m4a"]);
const EXT: Record<string, string> = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".flac": "audio/flac", ".ogg": "audio/ogg" };

export function mediaKind(mime: string | null | undefined, name: string): "video" | "audio" | null {
  const m = mime ?? EXT[(/\.[a-z0-9]+$/i.exec(name)?.[0] ?? "").toLowerCase()] ?? null;
  if (!m) return null;
  if (VIDEO_MIMES.has(m)) return "video";
  if (AUDIO_MIMES.has(m)) return "audio";
  return null;
}

/** What browsers play natively; anything else is transcoded on the fly. */
function playableAsIs(kind: "video" | "audio", container: string | null, videoCodec: string | null, audioCodec: string | null): boolean {
  const c = container ?? "";
  if (kind === "audio") return /mp3|mp4|m4a|aac|wav|ogg|flac|webm|matroska/.test(c) && (audioCodec === null || /mp3|aac|opus|vorbis|flac|pcm/.test(audioCodec));
  const okVideo = videoCodec === null || /h264|avc|vp8|vp9|av1/.test(videoCodec);
  const okAudio = audioCodec === null || /aac|mp3|opus|vorbis/.test(audioCodec);
  return /mp4|mov|webm|matroska/.test(c) && okVideo && okAudio;
}

export type Tools = { ffprobe: string | null; ffmpeg: string | null };

/**
 * Media (phase 22): a library of the household's video and audio, probed
 * once with ffprobe when it lands, served with byte ranges so players can
 * seek, and transcoded on the fly with ffmpeg when a browser or the TV
 * cannot play the original. Both tools are optional; without them the
 * library still lists and serves what browsers play natively.
 */
export class MediaService {
  constructor(
    private readonly db: Db,
    private readonly store: ContentStore,
    private readonly household: HouseholdService,
    private readonly logger: Logger,
    readonly tools: Tools,
  ) {}

  static async detectTools(): Promise<Tools> {
    const find = async (name: string) => {
      try {
        const { stdout } = await exec("/usr/bin/which", [name]);
        return stdout.trim() || null;
      } catch {
        return null;
      }
    };
    return { ffprobe: await find("ffprobe"), ffmpeg: await find("ffmpeg") };
  }

  /** Probe one file if it is media; idempotent. */
  async probe(fileId: string): Promise<MediaItem | null> {
    const f = this.db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).get();
    if (!f) return null;
    const kind = mediaKind(f.mime, f.name);
    if (!kind) return null;
    const existing = this.db.select().from(media).where(eq(media.fileId, fileId)).get();
    if (existing) return this.toItem(existing, f);
    let info: { durationS: number | null; width: number | null; height: number | null; videoCodec: string | null; audioCodec: string | null; container: string | null } = { durationS: null, width: null, height: null, videoCodec: null, audioCodec: null, container: null };
    if (this.tools.ffprobe) {
      try {
        const { stdout } = await exec(this.tools.ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", this.store.pathFor(f.sha256)], { maxBuffer: 4 * 1024 * 1024 });
        const j = JSON.parse(stdout) as { format?: { duration?: string; format_name?: string }; streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[] };
        const v = j.streams?.find((s) => s.codec_type === "video" && !/mjpeg|png/.test(s.codec_name ?? ""));
        const a = j.streams?.find((s) => s.codec_type === "audio");
        info = { durationS: j.format?.duration ? Number(j.format.duration) : null, width: v?.width ?? null, height: v?.height ?? null, videoCodec: v?.codec_name ?? null, audioCodec: a?.codec_name ?? null, container: j.format?.format_name ?? null };
      } catch (err) {
        this.logger.warn({ err, file: fileId }, "ffprobe could not read a media file");
      }
    }
    const container = info.container ?? (f.mime ? f.mime.split("/")[1] ?? null : null);
    const playable = playableAsIs(kind, container, info.videoCodec, info.audioCodec);
    this.db.insert(media).values({ fileId, householdId: f.householdId, kind, durationS: info.durationS, width: info.width, height: info.height, videoCodec: info.videoCodec, audioCodec: info.audioCodec, container, playable, probedAt: new Date().toISOString() }).onConflictDoNothing().run();
    return this.toItem(this.db.select().from(media).where(eq(media.fileId, fileId)).get()!, f);
  }

  list(reader: Person, kind?: "video" | "audio"): MediaItem[] {
    const rows = this.db
      .select({ m: media, f: files })
      .from(media)
      .innerJoin(files, eq(files.id, media.fileId))
      .where(kind ? and(eq(media.householdId, reader.householdId), eq(media.kind, kind), isNull(files.deletedAt)) : and(eq(media.householdId, reader.householdId), isNull(files.deletedAt)))
      .all()
      .filter((r) => this.household.canRead(reader, r.f.namespace as Namespace, r.f.ownerId));
    return rows.map((r) => this.toItem(r.m, r.f)).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  get(reader: Person, fileId: string): { item: MediaItem; sha256: string; size: number; mime: string | null } | null {
    const row = this.db.select({ m: media, f: files }).from(media).innerJoin(files, eq(files.id, media.fileId)).where(and(eq(media.fileId, fileId), isNull(files.deletedAt))).get();
    if (!row || row.f.householdId !== reader.householdId || !this.household.canRead(reader, row.f.namespace as Namespace, row.f.ownerId)) return null;
    return { item: this.toItem(row.m, row.f), sha256: row.f.sha256, size: row.f.size, mime: row.f.mime };
  }

  /** Transcode to fragmented MP4 (H.264 + AAC) or AAC audio on the fly. Returns null when ffmpeg is missing. */
  transcode(sha256: string, kind: "video" | "audio"): { stream: Readable; mime: string; stop: () => void } | null {
    if (!this.tools.ffmpeg) return null;
    const input = this.store.pathFor(sha256);
    const args =
      kind === "video"
        ? ["-v", "error", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-vf", "scale='min(1920,iw)':-2", "-c:a", "aac", "-b:a", "160k", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4", "pipe:1"]
        : ["-v", "error", "-i", input, "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"];
    const child = spawn(this.tools.ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    child.stderr.on("data", (d: Buffer) => this.logger.debug({ ffmpeg: d.toString().trim() }, "ffmpeg"));
    child.on("error", (err) => this.logger.warn({ err }, "ffmpeg failed to start"));
    return { stream: child.stdout, mime: kind === "video" ? "video/mp4" : "audio/mp4", stop: () => child.kill("SIGKILL") };
  }

  forget(fileId: string): void {
    this.db.delete(media).where(eq(media.fileId, fileId)).run();
  }

  private toItem(m: typeof media.$inferSelect, f: typeof files.$inferSelect): MediaItem {
    return MediaItem.parse({ fileId: f.id, name: f.name, kind: m.kind, size: f.size, durationS: m.durationS, width: m.width, height: m.height, codec: m.videoCodec ?? m.audioCodec, playable: m.playable, modifiedAt: f.modifiedAt, namespace: f.namespace });
  }
}
