import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";
import { MediaService, mediaKind } from "../src/media.ts";

const exec = promisify(execFile);
const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-media-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let tools = { ffmpeg: null as string | null, ffprobe: null as string | null };
type Item = { fileId: string; name: string; kind: string; playable: boolean; durationS: number | null; width: number | null; codec: string | null };


beforeAll(async () => {
  tools = await MediaService.detectTools();
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { tools });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("media (phase 22)", () => {
  it("tells video and audio from the rest", () => {
    expect(mediaKind("video/quicktime", "clip.mov")).toBe("video");
    expect(mediaKind(null, "song.MP3")).toBe("audio");
    expect(mediaKind("image/jpeg", "a.jpg")).toBeNull();
  });

  it("serves byte ranges so players can seek", async () => {
    const alex = services.household.personByEmail("alex@example.com")!;
    const entry = await services.files.put(alex, { name: "big.bin", path: "/", namespace: "personal", mime: "application/octet-stream" }, Buffer.from("0123456789abcdef"));
    const whole = await app.inject({ method: "GET", url: `/v1/files/${entry.id}/content`, headers: auth(owner) });
    expect(whole.statusCode).toBe(200);
    expect(whole.headers["accept-ranges"]).toBe("bytes");
    const part = await app.inject({ method: "GET", url: `/v1/files/${entry.id}/content`, headers: { ...auth(owner), range: "bytes=4-7" } });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe("bytes 4-7/16");
    expect(part.body).toBe("4567");
    const tail = await app.inject({ method: "GET", url: `/v1/files/${entry.id}/content`, headers: { ...auth(owner), range: "bytes=-3" } });
    expect(tail.body).toBe("def");
    const open = await app.inject({ method: "GET", url: `/v1/files/${entry.id}/content`, headers: { ...auth(owner), range: "bytes=10-" } });
    expect(open.body).toBe("abcdef");
    expect((await app.inject({ method: "GET", url: `/v1/files/${entry.id}/content`, headers: { ...auth(owner), range: "bytes=99-" } })).statusCode).toBe(416);
  });

  it("probes a real clip, lists it, plays the native one directly and transcodes the other", async () => {
    if (!tools.ffmpeg || !tools.ffprobe) {
      // No ffmpeg on this machine (CI): the library still lists by type, without probe details.
      const alex = services.household.personByEmail("alex@example.com")!;
      const entry = await services.files.put(alex, { name: "voice.mp3", path: "/Music", namespace: "personal", mime: "audio/mpeg" }, Buffer.from("not really mp3"));
      await new Promise((r) => setTimeout(r, 100));
      const list = await app.inject({ method: "GET", url: "/v1/media", headers: auth(owner) });
      expect(list.json<{ items: Item[]; tools: { ffmpeg: boolean } }>()).toMatchObject({ tools: { ffmpeg: false } });
      expect(list.json<{ items: Item[] }>().items.map((i) => i.fileId)).toContain(entry.id);
      return;
    }
    const dir = join(dataRoot, "clips");
    await (await import("node:fs/promises")).mkdir(dir, { recursive: true });
    // A two-second test pattern with a tone: one as H.264 MP4 (plays as is), one as MPEG-2 in a MOV (needs the box).
    await exec(tools.ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", join(dir, "native.mp4")]);
    await exec(tools.ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15", "-t", "2", "-c:v", "mpeg2video", join(dir, "old.mov")]);
    await exec(tools.ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "2", "-c:a", "flac", join(dir, "tone.flac")]);
    const alex = services.household.personByEmail("alex@example.com")!;
    const native = await services.files.put(alex, { name: "native.mp4", path: "/Videos", namespace: "personal", mime: "video/mp4" }, await readFile(join(dir, "native.mp4")));
    const old = await services.files.put(alex, { name: "old.mov", path: "/Videos", namespace: "personal", mime: "video/quicktime" }, await readFile(join(dir, "old.mov")));
    const tone = await services.files.put(alex, { name: "tone.flac", path: "/Music", namespace: "personal", mime: "audio/flac" }, await readFile(join(dir, "tone.flac")));
    for (let i = 0; i < 100 && services.media.list(alex).length < 3; i += 1) await new Promise((r) => setTimeout(r, 50));

    const list = await app.inject({ method: "GET", url: "/v1/media?kind=video", headers: auth(owner) });
    const items = list.json<{ items: Item[] }>().items;
    expect(items.map((i) => i.name).sort()).toEqual(["native.mp4", "old.mov"]);
    const n = items.find((i) => i.fileId === native.id)!;
    expect(n).toMatchObject({ kind: "video", playable: true, width: 320, codec: "h264" });
    expect(n.durationS).toBeCloseTo(2, 0);
    expect(items.find((i) => i.fileId === old.id)).toMatchObject({ playable: false, codec: "mpeg2video" });
    const audio = (await app.inject({ method: "GET", url: "/v1/media?kind=audio", headers: auth(owner) })).json<{ items: Item[] }>().items;
    expect(audio.find((i) => i.fileId === tone.id)).toMatchObject({ kind: "audio", playable: true, codec: "flac" });

    const direct = await app.inject({ method: "GET", url: `/v1/media/${native.id}/stream`, headers: auth(owner) });
    expect(direct.statusCode).toBe(307);
    expect(direct.headers.location).toBe(`/v1/files/${native.id}/content`);

    const transcoded = await app.inject({ method: "GET", url: `/v1/media/${old.id}/stream`, headers: auth(owner) });
    expect(transcoded.statusCode).toBe(200);
    expect(transcoded.headers["content-type"]).toBe("video/mp4");
    expect(transcoded.rawPayload.length).toBeGreaterThan(10_000);
    expect(transcoded.rawPayload.subarray(4, 8).toString()).toBe("ftyp"); // an MP4 box the browser can start on
  }, 60_000);
});
