import { createCipheriv, createDecipheriv, createECDH, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, hkdfSync, randomBytes, sign, type JsonWebKey, type KeyObject } from "node:crypto";

/**
 * Web Push without a library (gap 17): RFC 8291 message encryption
 * (aes128gcm, RFC 8188) and RFC 8292 VAPID, on node:crypto alone. The
 * push service (Apple, Google, Mozilla) only ever sees ciphertext; the
 * request itself leaves through the Gate like every other crossing.
 */
export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type VapidKeys = { publicKey: string; privateKeyPem: string };

const b64u = (b: Buffer) => b.toString("base64url");

/** A fresh VAPID key pair: the public half goes to browsers, the private half is sealed in keys/. */
export function generateVapid(): VapidKeys {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = pair.publicKey.export({ format: "jwk" });
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(raw.x!, "base64url"), Buffer.from(raw.y!, "base64url")]));
  return { publicKey, privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }) as string };
}

/** The Authorization header for one push service origin, good for 12 hours. */
export function vapidAuthorization(keys: VapidKeys, audience: string, subject: string, now = Date.now()): string {
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const signingInput = `${header}.${claims}`;
  const priv: KeyObject = createPrivateKey(keys.privateKeyPem);
  const der = sign("sha256", Buffer.from(signingInput), priv);
  return `vapid t=${signingInput}.${b64u(derToJose(der))}, k=${keys.publicKey}`;
}

/** DER ECDSA signature to the fixed 64-byte r||s form JWTs use. */
function derToJose(der: Buffer): Buffer {
  let offset = 2;
  const take = () => {
    if (der[offset] !== 0x02) throw new Error("bad signature");
    const len = der[offset + 1]!;
    let v = der.subarray(offset + 2, offset + 2 + len);
    offset += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    return Buffer.concat([Buffer.alloc(32 - v.length), v]);
  };
  const r = take();
  const s = take();
  return Buffer.concat([r, s]);
}

/**
 * RFC 8291: ECDH with the browser's key, HKDF with the auth secret, then one
 * aes128gcm record (RFC 8188) with a 2-byte padding delimiter. Returns the
 * body and the headers the push service needs.
 */
export function encryptPayload(subscription: PushSubscription, payload: Buffer): { body: Buffer; headers: Record<string, string> } {
  const clientPublic = Buffer.from(subscription.keys.p256dh, "base64url");
  const auth = Buffer.from(subscription.keys.auth, "base64url");
  if (clientPublic.length !== 65 || auth.length !== 16) throw new Error("the subscription's keys are malformed");
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(clientPublic);
  const salt = randomBytes(16);
  // RFC 8291 §3.3 and §3.4
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublic, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([payload, Buffer.from([2])]); // the last record's delimiter
  const ct = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  // RFC 8188 header: salt(16) | rs(4) | idlen(1) | keyid(65)
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  const body = Buffer.concat([salt, rs, Buffer.from([serverPublic.length]), serverPublic, ct]);
  return { body, headers: { "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "86400", urgency: "normal" } };
}

/** The push service's origin, the VAPID audience. */
export function audienceOf(endpoint: string): string {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

/** A stable id for a subscription without keeping the endpoint in the clear everywhere. */
export function subscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
}

/** For tests: decrypt what a browser would, with the browser's private key. */
export function decryptForTest(browserPrivateJwk: { d: string; x: string; y: string; kty: string; crv: string }, auth: Buffer, body: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body[20]!;
  const serverPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const priv = createPrivateKey({ key: browserPrivateJwk as unknown as JsonWebKey, format: "jwk" });
  const pub = createPublicKey(priv).export({ format: "jwk" });
  const clientPublic = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(browserPrivateJwk.d, "base64url"));
  const shared = ecdh.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublic, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return plain.subarray(0, plain.length - 1);
}

