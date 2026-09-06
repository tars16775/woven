/**
 * Local HTTPS for the Inside (ADR 0006).
 *
 * The core issues its own household certificate authority on first start and
 * signs a server certificate for its names and LAN addresses. Devices trust
 * the CA once (by scanning a code on the trust page); after that every
 * connection to the core is real TLS, which passkeys require. Nothing here
 * talks to the network: no ACME, no public CA, no clock but the box's own.
 */
import "reflect-metadata";
import { webcrypto, type webcrypto as WebCrypto } from "node:crypto";
import { createCipheriv, createDecipheriv } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as x509 from "@peculiar/x509";

x509.cryptoProvider.set(webcrypto);

const subtle = webcrypto.subtle;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const DAY = 24 * 60 * 60 * 1000;
/** Apple and Chrome refuse leaf certificates valid for more than 398 days. */
const LEAF_DAYS = 397;
const CA_DAYS = 3650;
/** Reissue the leaf when this close to expiry. */
const RENEW_WITHIN_DAYS = 30;

export type TlsMaterial = {
  ca: { pem: string; fingerprint: string; notAfter: string };
  server: { certPem: string; keyPem: string; notAfter: string; dns: string[]; ips: string[] };
  /** True when this call created or renewed the server certificate. */
  issued: boolean;
  /** True when this call created the household CA. */
  createdCa: boolean;
};

export type EnsureTlsOptions = {
  keysDir: string;
  /** Private keys on disk are sealed under this (derived from the household key); without it they are plain PEM. */
  key?: Buffer;
  dns: string[];
  ips: string[];
  now?: Date;
};

const files = (dir: string) => ({
  caKey: join(dir, "ca.key"),
  caCert: join(dir, "ca.crt"),
  serverKey: join(dir, "server.key"),
  serverCert: join(dir, "server.crt"),
});

/** Make sure a CA and a server certificate covering `dns` and `ips` exist and are fresh. */
export async function ensureHouseholdTls(opts: EnsureTlsOptions): Promise<TlsMaterial> {
  const now = opts.now ?? new Date();
  const f = files(opts.keysDir);
  await mkdir(opts.keysDir, { recursive: true, mode: 0o700 });

  let createdCa = false;
  let caCertPem = await readOrNull(f.caCert);
  let caKeyPem = await readPrivateKey(f.caKey, opts.key);
  if (!caCertPem || !caKeyPem) {
    const made = await createCa(now);
    caCertPem = made.certPem;
    caKeyPem = made.keyPem;
    await writeFile(f.caKey, sealPrivateKey(caKeyPem, opts.key), { mode: 0o600 });
    await writeFile(f.caCert, caCertPem, { mode: 0o644 });
    createdCa = true;
  }
  const caCert = new x509.X509Certificate(caCertPem);

  const dns = unique(opts.dns.map((d) => d.toLowerCase()));
  const ips = unique(["127.0.0.1", ...opts.ips]);

  let issued = false;
  let certPem = await readOrNull(f.serverCert);
  let keyPem = await readPrivateKey(f.serverKey, opts.key);
  if (!certPem || !keyPem || createdCa || needsReissue(new x509.X509Certificate(certPem), dns, ips, now)) {
    const made = await createServerCert({ caCert, caKeyPem, dns, ips, now });
    certPem = made.certPem;
    keyPem = made.keyPem;
    await writeFile(f.serverKey, sealPrivateKey(keyPem, opts.key), { mode: 0o600 });
    await writeFile(f.serverCert, certPem, { mode: 0o644 });
    issued = true;
  }
  const serverCert = new x509.X509Certificate(certPem);
  const sans = sansOf(serverCert);

  return {
    ca: { pem: caCertPem, fingerprint: await fingerprint(caCert), notAfter: caCert.notAfter.toISOString() },
    server: { certPem, keyPem, notAfter: serverCert.notAfter.toISOString(), dns: sans.dns, ips: sans.ips },
    issued,
    createdCa,
  };
}

/** SHA-256 of the DER certificate, colon-separated, as Keychain and browsers show it. */
export async function fingerprint(cert: x509.X509Certificate): Promise<string> {
  const buf = Buffer.from(await cert.getThumbprint("SHA-256"));
  return buf
    .toString("hex")
    .toUpperCase()
    .match(/.{2}/g)!
    .join(":");
}

export function needsReissue(cert: x509.X509Certificate, dns: string[], ips: string[], now: Date): boolean {
  if (cert.notAfter.getTime() - now.getTime() < RENEW_WITHIN_DAYS * DAY) return true;
  if (cert.notBefore.getTime() > now.getTime()) return true;
  const sans = sansOf(cert);
  return dns.some((d) => !sans.dns.includes(d)) || ips.some((ip) => !sans.ips.includes(ip));
}

export function sansOf(cert: x509.X509Certificate): { dns: string[]; ips: string[] } {
  const ext = cert.getExtension(x509.SubjectAlternativeNameExtension);
  const dns: string[] = [];
  const ips: string[] = [];
  for (const name of ext?.names.items ?? []) {
    if (name.type === "dns") dns.push(name.value.toLowerCase());
    if (name.type === "ip") ips.push(name.value);
  }
  return { dns, ips };
}

async function createCa(now: Date): Promise<{ certPem: string; keyPem: string }> {
  const keys = (await subtle.generateKey(ALG, true, ["sign", "verify"]));
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: serial(),
    name: "CN=Woven Household CA, O=Woven",
    notBefore: new Date(now.getTime() - DAY),
    notAfter: new Date(now.getTime() + CA_DAYS * DAY),
    signingAlgorithm: ALG,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  return { certPem: cert.toString("pem"), keyPem: await privateKeyPem(keys.privateKey) };
}

async function createServerCert(input: { caCert: x509.X509Certificate; caKeyPem: string; dns: string[]; ips: string[]; now: Date }) {
  const caKey = await subtle.importKey("pkcs8", x509.PemConverter.decode(input.caKeyPem)[0]!, ALG, false, ["sign"]);
  const keys = (await subtle.generateKey(ALG, true, ["sign", "verify"]));
  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: serial(),
    subject: "CN=Woven Core, O=Woven",
    issuer: input.caCert.subject,
    notBefore: new Date(input.now.getTime() - DAY),
    notAfter: new Date(input.now.getTime() + LEAF_DAYS * DAY),
    signingAlgorithm: ALG,
    publicKey: keys.publicKey,
    signingKey: caKey,
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension([
        ...input.dns.map((value) => ({ type: "dns" as const, value })),
        ...input.ips.map((value) => ({ type: "ip" as const, value })),
      ]),
      await x509.AuthorityKeyIdentifierExtension.create(input.caCert),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  return { certPem: cert.toString("pem"), keyPem: await privateKeyPem(keys.privateKey) };
}

async function privateKeyPem(key: WebCrypto.CryptoKey): Promise<string> {
  return x509.PemConverter.encode(await subtle.exportKey("pkcs8", key), "PRIVATE KEY");
}

function serial(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(16));
  bytes[0] = bytes[0]! & 0x7f; // positive integer
  return Buffer.from(bytes).toString("hex");
}

const SEALED = "WOVK1\n";

/** A private key sealed under the keys key: AES-256-GCM, iv + ciphertext + tag, base64 after a marker line. */
export function sealPrivateKey(pem: string, key: Buffer | undefined): string {
  if (!key) return pem;
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  return `${SEALED}${Buffer.concat([Buffer.from(iv), ct, cipher.getAuthTag()]).toString("base64")}\n`;
}

export function openPrivateKey(text: string, key: Buffer | undefined): string {
  if (!text.startsWith(SEALED)) return text; // plain PEM from before sealing
  if (!key) throw new Error("this private key is sealed under the household key, which is not available");
  const raw = Buffer.from(text.slice(SEALED.length).trim(), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
}

/** Read a private key, sealing a plain one in place the first time a key is available. */
async function readPrivateKey(path: string, key: Buffer | undefined): Promise<string | null> {
  const text = await readOrNull(path);
  if (text === null) return null;
  const pem = openPrivateKey(text, key);
  if (key && !text.startsWith(SEALED)) await writeFile(path, sealPrivateKey(pem, key), { mode: 0o600 });
  return pem;
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
