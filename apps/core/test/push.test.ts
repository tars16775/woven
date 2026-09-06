import { createECDH, createPublicKey, generateKeyPairSync, randomBytes, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { audienceOf, decryptForTest, encryptPayload, generateVapid, subscriptionId, vapidAuthorization } from "../src/push/webpush.ts";

/** A browser's push keys, as PushManager.subscribe would make them. */
function browserKeys() {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.privateKey.export({ format: "jwk" }) as { d: string; x: string; y: string; kty: string; crv: string };
  const p256dh = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
  const auth = randomBytes(16);
  return { jwk, p256dh, auth, subscription: { endpoint: "https://web.push.apple.com/QAbc123", keys: { p256dh, auth: auth.toString("base64url") } } };
}

describe("web push without a library (gap 17)", () => {
  it("encrypts a payload the browser can decrypt, in aes128gcm with a single record", () => {
    const b = browserKeys();
    const payload = Buffer.from(JSON.stringify({ title: "Woven", body: "hello" }));
    const { body, headers } = encryptPayload(b.subscription, payload);
    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(body.readUInt32BE(16)).toBe(4096); // record size
    expect(body[20]).toBe(65); // key id length: the server's public key
    expect(body.length).toBe(21 + 65 + payload.length + 1 + 16);
    expect(decryptForTest(b.jwk, b.auth, body).toString()).toBe(payload.toString());
    // A different browser cannot open it.
    const other = browserKeys();
    expect(() => decryptForTest(other.jwk, b.auth, body)).toThrow();
    // Malformed keys are refused before anything is sent.
    expect(() => encryptPayload({ endpoint: b.subscription.endpoint, keys: { p256dh: "short", auth: "x" } }, payload)).toThrow(/malformed/);
  });

  it("signs a VAPID token the push service can verify against the public key", () => {
    const keys = generateVapid();
    expect(Buffer.from(keys.publicKey, "base64url")).toHaveLength(65);
    const header = vapidAuthorization(keys, "https://web.push.apple.com", "mailto:core@woven.local", 1_700_000_000_000);
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(m[2]).toBe(keys.publicKey);
    const [h, c, s] = m[1]!.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString()) as { aud: string; exp: number; sub: string };
    expect(claims).toMatchObject({ aud: "https://web.push.apple.com", sub: "mailto:core@woven.local" });
    expect(claims.exp).toBe(1_700_000_000 + 12 * 3600);
    // The raw public key back into a KeyObject, and the r||s signature checks out.
    const raw = Buffer.from(keys.publicKey, "base64url");
    const pub = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"))).toBe(true);
    expect(verify("sha256", Buffer.from(`${h}.${c}x`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"))).toBe(false);
  });

  it("derives the audience and a stable id from the endpoint", () => {
    expect(audienceOf("https://fcm.googleapis.com/fcm/send/abc")).toBe("https://fcm.googleapis.com");
    expect(subscriptionId("https://a/x")).toHaveLength(24);
    expect(subscriptionId("https://a/x")).toBe(subscriptionId("https://a/x"));
    expect(subscriptionId("https://a/y")).not.toBe(subscriptionId("https://a/x"));
    // ECDH sanity: both sides reach the same secret.
    const a = createECDH("prime256v1");
    const b = createECDH("prime256v1");
    a.generateKeys();
    b.generateKeys();
    expect(a.computeSecret(b.getPublicKey()).equals(b.computeSecret(a.getPublicKey()))).toBe(true);
  });
});
