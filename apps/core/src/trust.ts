import Fastify from "fastify";
import QRCode from "qrcode";
import type { Logger } from "./logger.ts";
import type { TlsMaterial } from "./tls.ts";

export type TrustServerOptions = {
  logger: Logger;
  tls: TlsMaterial;
  /** The address the trust page tells people to open, e.g. http://woven.local:4001 */
  trustUrl: string;
  /** The HTTPS address to try afterwards. */
  coreUrl: string;
  version: string;
};

/**
 * The one plain-HTTP surface: a page that hands a device the household CA.
 * It carries nothing about the household except the CA fingerprint, which
 * is public by nature. Everything else is HTTPS.
 */
export async function buildTrustServer(opts: TrustServerOptions) {
  const app = Fastify({ loggerInstance: opts.logger });
  const caUrl = `${opts.trustUrl}/ca.crt`;
  const qr = await QRCode.toString(caUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-woven-core", opts.version);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
  });

  app.get("/ca.crt", async (_req, reply) => {
    return reply
      .type("application/x-x509-ca-cert")
      .header("content-disposition", 'attachment; filename="woven-household-ca.crt"')
      .send(opts.tls.ca.pem);
  });

  app.get("/trust.json", async () => ({
    fingerprint: opts.tls.ca.fingerprint,
    caUrl,
    coreUrl: opts.coreUrl,
    names: opts.tls.server.dns,
    addresses: opts.tls.server.ips,
  }));

  app.get("/", async (_req, reply) => {
    return reply.type("text/html; charset=utf-8").send(page({ ...opts, caUrl, qr }));
  });

  return app;
}

function page(p: { tls: TlsMaterial; caUrl: string; coreUrl: string; qr: string }): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trust your Woven Core</title>
<style>
  body{margin:0;font:16px/1.5 -apple-system,system-ui,sans-serif;background:#0b0b0c;color:#f4f4f2;display:grid;place-items:center;min-height:100vh}
  main{max-width:34rem;padding:2rem}
  h1{font-size:1.75rem;letter-spacing:-.02em;margin:0 0 .5rem}
  p{color:#b5b5b0;margin:.5rem 0}
  .qr{background:#fff;border-radius:16px;padding:12px;width:220px;margin:1.5rem 0}
  .qr svg{display:block;width:100%;height:auto}
  a.btn{display:inline-block;background:#f4f4f2;color:#0b0b0c;padding:.75rem 1.1rem;border-radius:999px;text-decoration:none;font-weight:600}
  code{font:13px ui-monospace,Menlo,monospace;word-break:break-all;color:#e8e8e4}
  ol{padding-left:1.2rem;color:#b5b5b0}
</style>
<main>
  <h1>Trust your Woven Core</h1>
  <p>This box issues its own certificates, so nothing about your home ever touches a public authority. Install the household certificate once on each device.</p>
  <div class="qr">${p.qr}</div>
  <p><a class="btn" href="${esc(p.caUrl)}">Download the household certificate</a></p>
  <ol>
    <li>Install it (iPhone: Settings → Profile Downloaded; Mac: double-click, then set Trust to Always; Android: Settings → Security → Install a certificate → CA).</li>
    <li>Check the fingerprint matches: <code>${esc(p.tls.ca.fingerprint)}</code></li>
    <li>Open <a href="${esc(p.coreUrl)}" style="color:#f4f4f2">${esc(p.coreUrl)}</a>.</li>
  </ol>
  <p>Names on this certificate: <code>${esc([...p.tls.server.dns, ...p.tls.server.ips].join(", "))}</code></p>
</main>`;
}
