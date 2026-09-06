import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Frames on the relay (gap 21): AES-256-GCM under the key one device and
 * this Core exchanged at home, with the device id as associated data so a
 * frame cannot be replayed under another id. The relay carries these as
 * opaque strings. The browser side speaks the same format with WebCrypto.
 *
 *   {"d":"<deviceId>","n":"<base64 nonce>","c":"<base64 ciphertext+tag>"}
 */
export type Frame = { d: string; n: string; c: string };

export function seal(key: Buffer, deviceId: string, plain: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(deviceId, "utf8"));
  const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ d: deviceId, n: nonce.toString("base64"), c: ct.toString("base64") } satisfies Frame);
}

export function parseFrame(text: string): Frame | null {
  try {
    const f = JSON.parse(text) as Partial<Frame>;
    if (typeof f.d !== "string" || typeof f.n !== "string" || typeof f.c !== "string") return null;
    return f as Frame;
  } catch {
    return null;
  }
}

export function open(key: Buffer, frame: Frame): Buffer {
  const nonce = Buffer.from(frame.n, "base64");
  const ct = Buffer.from(frame.c, "base64");
  if (nonce.length !== 12 || ct.length < 16) throw new Error("malformed frame");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(frame.d, "utf8"));
  decipher.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]);
}

/** Seal a small secret for the database under a purpose key: nonce + ciphertext + tag, base64. */
export function sealSecret(key: Buffer, plain: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  return Buffer.concat([nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag()]).toString("base64");
}

export function openSecret(key: Buffer, sealed: string): Buffer {
  const raw = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]);
}

/** What travels inside a frame: one HTTP request or one response, or a subscription to the event stream. */
export type TunnelRequest = { i: string; m: string; p: string; h: Record<string, string>; b: string | null };
export type TunnelResponse = { i: string; s: number; h: Record<string, string>; b: string | null };
export type TunnelEvent = { i: string; ev: unknown };
