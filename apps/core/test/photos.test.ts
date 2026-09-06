import { mkdtempSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";
import { mimeForName } from "../src/photos.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-photos-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
type P = { id: string; name: string; takenAt: string; width: number; height: number; camera: string | null; place: { lat: number; lon: number } | null };


/** A real JPEG with EXIF: a date, a camera, and a place. */
async function jpeg(w: number, h: number, exif?: { date?: string; make?: string; model?: string; lat?: number; lon?: number }) {
  const img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 120, b: 200 } } }).jpeg({ quality: 70 });
  if (!exif) return img.toBuffer();
  const ifd0: Record<string, string> = {};
  if (exif.make) ifd0.Make = exif.make;
  if (exif.model) ifd0.Model = exif.model;
  const ifd2: Record<string, string> = {};
  if (exif.date) ifd2.DateTimeOriginal = exif.date;
  const gps: Record<string, string> = {};
  if (exif.lat !== undefined && exif.lon !== undefined) {
    const dms = (v: number) => {
      const a = Math.abs(v);
      const d = Math.floor(a);
      const m = Math.floor((a - d) * 60);
      const s = ((a - d) * 60 - m) * 60;
      return `${d}/1 ${m}/1 ${Math.round(s * 100)}/100`;
    };
    gps.GPSLatitudeRef = exif.lat >= 0 ? "N" : "S";
    gps.GPSLatitude = dms(exif.lat);
    gps.GPSLongitudeRef = exif.lon >= 0 ? "E" : "W";
    gps.GPSLongitude = dms(exif.lon);
  }
  return img.withExif({ IFD0: ifd0, IFD2: ifd2, IFD3: gps }).toBuffer();
}

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"));
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

describe("photos (phase 20)", () => {
  it("knows an image by its name", () => {
    expect(mimeForName("IMG_0001.HEIC")).toBe("image/heic");
    expect(mimeForName("notes.txt")).toBeNull();
  });

  it("imports a folder: EXIF date, camera and place, thumbnails and previews, a timeline newest first", async () => {
    const dir = join(dataRoot, "Lake trip");
    await mkdir(join(dir, "day2"), { recursive: true });
    await writeFile(join(dir, "IMG_1.jpg"), await jpeg(1600, 1200, { date: "2026:07:12 10:30:00", make: "Apple", model: "Apple iPhone 15", lat: 27.93, lon: -81.32 }));
    await writeFile(join(dir, "day2", "IMG_2.jpg"), await jpeg(1200, 1600, { date: "2026:07:13 09:00:00", make: "Canon", model: "EOS R6" }));
    await writeFile(join(dir, "plain.png"), await sharp({ create: { width: 300, height: 200, channels: 4, background: "#fff" } }).png().toBuffer());
    await writeFile(join(dir, "notes.txt"), "not a photo");

    const res = await app.inject({ method: "POST", url: "/v1/photos/import", headers: auth(owner), payload: { folder: dir } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ files: 3, photos: 3 });

    const tl = await app.inject({ method: "GET", url: "/v1/photos", headers: auth(owner) });
    const { photos, total } = tl.json<{ photos: P[]; total: number }>();
    expect(total).toBe(3);
    expect(photos.map((p) => p.name)).toEqual(expect.arrayContaining(["IMG_1.jpg", "IMG_2.jpg", "plain.png"]));
    const one = photos.find((p) => p.name === "IMG_1.jpg")!;
    expect(one).toMatchObject({ width: 1600, height: 1200, camera: "Apple iPhone 15" });
    expect(one.takenAt.startsWith("2026-07-12")).toBe(true);
    expect(one.place?.lat).toBeCloseTo(27.93, 2);
    expect(one.place?.lon).toBeCloseTo(-81.32, 2);
    const two = photos.find((p) => p.name === "IMG_2.jpg")!;
    expect(two.camera).toBe("Canon EOS R6");
    expect(new Date(two.takenAt).getTime()).toBeGreaterThan(new Date(one.takenAt).getTime());
    expect(photos[0]?.name === "plain.png" || photos[0]?.name === "IMG_2.jpg").toBe(true); // newest first (plain.png took the file's own date: now)

    const thumb = await app.inject({ method: "GET", url: `/v1/photos/${one.id}/thumb`, headers: auth(owner) });
    expect(thumb.statusCode).toBe(200);
    expect(thumb.headers["content-type"]).toBe("image/jpeg");
    const meta = await sharp(thumb.rawPayload).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(512);
    const preview = await app.inject({ method: "GET", url: `/v1/photos/${one.id}/preview`, headers: auth(owner) });
    expect((await sharp(preview.rawPayload).metadata()).width).toBe(1600); // never enlarged

    const stats = await app.inject({ method: "GET", url: "/v1/photos/stats", headers: auth(owner) });
    expect(stats.json()).toMatchObject({ total: 3, newThisWeek: 3, withPlace: 1 });
    expect(stats.json<{ months: { month: string }[] }>().months.map((m) => m.month)).toContain("2026-07");

    // Importing again changes nothing: same bytes, same rows.
    expect((await app.inject({ method: "POST", url: "/v1/photos/import", headers: auth(owner), payload: { folder: dir } })).json()).toEqual({ files: 3, photos: 0 });
    expect((await app.inject({ method: "GET", url: "/v1/photos", headers: auth(owner) })).json<{ total: number }>().total).toBe(3);
    const files = await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/Photos/Lake trip", headers: auth(owner) });
    expect(files.json<{ files: { name: string }[]; folders: { name: string }[] }>().folders.map((f) => f.name)).toEqual(["day2"]);
  });

  it("an uploaded image becomes a photo on its own; deleting the file takes it away", async () => {
    const bytes = await jpeg(800, 600);
    const alex = services.household.personByEmail("alex@example.com")!;
    const entry = await services.files.put(alex, { name: "upload.jpg", path: "/Camera", namespace: "personal", mime: "image/jpeg" }, bytes);
    for (let i = 0; i < 50; i += 1) {
      if ((await app.inject({ method: "GET", url: "/v1/photos", headers: auth(owner) })).json<{ total: number }>().total === 4) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const before = (await app.inject({ method: "GET", url: "/v1/photos", headers: auth(owner) })).json<{ photos: P[]; total: number }>();
    expect(before.total).toBe(4);
    const mine = before.photos.find((p) => p.name === "upload.jpg")!;
    await app.inject({ method: "DELETE", url: `/v1/files/${entry.id}`, headers: auth(owner) });
    expect((await app.inject({ method: "GET", url: "/v1/photos", headers: auth(owner) })).json<{ total: number }>().total).toBe(3);
    expect((await app.inject({ method: "GET", url: `/v1/photos/${mine.id}/thumb`, headers: auth(owner) })).statusCode).toBe(404);
    expect(data.ledger.verify().ok).toBe(true);
  });
});
