import { createHash, createPublicKey, verify } from "node:crypto";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket, type RawData } from "ws";

/**
 * The Woven relay (gap 21). A Core keeps an outbound WebSocket here; a
 * dashboard away from home connects to `/c/<coreId>` and the relay pipes
 * frames between the two. Every frame is encrypted end to end with a key
 * the browser and the Core exchanged at home, so the relay holds no
 * household data: it sees a Core's public identity, that some client is
 * talking to it, and ciphertext. No accounts, no storage, no logs of
 * content. A Core proves it owns its id by signing a challenge with the
 * Ed25519 key behind it.
 *
 * Wire format, all JSON text frames:
 *   core  -> relay   {t:"hello", pub, ts, sig}          then  {t:"f", c, d} | {t:"close", c}
 *   relay -> core    {t:"ready", coreId} | {t:"open", c} | {t:"f", c, d} | {t:"close", c}
 *   client<-> relay  raw frame strings both ways; the relay never parses them
 */
export type RelayOptions = { port?: number; host?: string; maxClientsPerCore?: number; maxFrameBytes?: number; log?: (line: string) => void };

type Core = { socket: WebSocket; clients: Map<string, WebSocket>; since: number; frames: number };

export const CHALLENGE_PREFIX = "woven-relay|";

function rawText(raw: RawData): string {
  return Buffer.isBuffer(raw) ? raw.toString("utf8") : Array.isArray(raw) ? Buffer.concat(raw).toString("utf8") : Buffer.from(raw).toString("utf8");
}

export function coreIdOf(pubDer: Buffer): string {
  return createHash("sha256").update(pubDer).digest("hex").slice(0, 32);
}

export function startRelay(opts: RelayOptions = {}): Promise<{ url: string; port: number; close: () => Promise<void>; cores: () => string[] }> {
  const cores = new Map<string, Core>();
  const maxClients = opts.maxClientsPerCore ?? 32;
  const maxFrame = opts.maxFrameBytes ?? 4 * 1024 * 1024;
  const log = opts.log ?? (() => undefined);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://relay");
    res.setHeader("cache-control", "no-store");
    if (url.pathname === "/health") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, cores: cores.size, at: new Date().toISOString() }));
      return;
    }
    const m = /^\/status\/([a-f0-9]{32})$/.exec(url.pathname);
    if (m) {
      res.setHeader("content-type", "application/json");
      const core = cores.get(m[1]!);
      res.end(JSON.stringify({ online: !!core, clients: core?.clients.size ?? 0 }));
      return;
    }
    if (url.pathname === "/") {
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Woven relay. It carries encrypted frames between a household's Core and its own dashboards, and keeps nothing.\n");
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: maxFrame });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://relay");
    if (url.pathname === "/core") {
      wss.handleUpgrade(req, socket, head, (ws) => attachCore(ws));
      return;
    }
    const m = /^\/c\/([a-f0-9]{32})$/.exec(url.pathname);
    if (m) {
      wss.handleUpgrade(req, socket, head, (ws) => attachClient(ws, m[1]!));
      return;
    }
    socket.destroy();
  });

  function attachCore(ws: WebSocket) {
    let id: string | null = null;
    const hello = setTimeout(() => ws.close(4408, "hello took too long"), 10_000);
    ws.on("message", (raw: RawData) => {
      let msg: { t?: string; pub?: string; ts?: number; sig?: string; c?: string; d?: string };
      try {
        msg = JSON.parse(rawText(raw)) as typeof msg;
      } catch {
        ws.close(4400, "not json");
        return;
      }
      if (id === null) {
        if (msg.t !== "hello" || typeof msg.pub !== "string" || typeof msg.ts !== "number" || typeof msg.sig !== "string") return ws.close(4400, "hello first");
        if (Math.abs(Date.now() - msg.ts) > 5 * 60_000) return ws.close(4401, "clock");
        let pubDer: Buffer;
        try {
          pubDer = Buffer.from(msg.pub, "base64url");
          const key = createPublicKey({ key: pubDer, format: "der", type: "spki" });
          const coreId = coreIdOf(pubDer);
          if (!verify(null, Buffer.from(`${CHALLENGE_PREFIX}${coreId}|${msg.ts}`), key, Buffer.from(msg.sig, "base64url"))) return ws.close(4401, "bad signature");
          id = coreId;
        } catch {
          return ws.close(4401, "bad key");
        }
        clearTimeout(hello);
        const previous = cores.get(id);
        if (previous) {
          // A Core reconnecting replaces its old socket; its old clients are told to reconnect.
          for (const c of previous.clients.values()) c.close(4410, "core reconnected");
          previous.socket.close(4409, "replaced");
        }
        cores.set(id, { socket: ws, clients: new Map(), since: Date.now(), frames: 0 });
        ws.send(JSON.stringify({ t: "ready", coreId: id }));
        log(`core ${id} online`);
        return;
      }
      const core = cores.get(id);
      if (!core) return;
      if (msg.t === "f" && typeof msg.c === "string" && typeof msg.d === "string") {
        const client = core.clients.get(msg.c);
        if (client && client.readyState === WebSocket.OPEN) {
          core.frames += 1;
          client.send(msg.d);
        }
      } else if (msg.t === "close" && typeof msg.c === "string") {
        core.clients.get(msg.c)?.close(4000, "closed by core");
        core.clients.delete(msg.c);
      }
    });
    const ping = setInterval(() => (ws.readyState === WebSocket.OPEN ? ws.ping() : undefined), 25_000);
    ws.on("close", () => {
      clearTimeout(hello);
      clearInterval(ping);
      if (id && cores.get(id)?.socket === ws) {
        for (const c of cores.get(id)!.clients.values()) c.close(4410, "core offline");
        cores.delete(id);
        log(`core ${id} offline`);
      }
    });
    ws.on("error", () => ws.close());
  }

  function attachClient(ws: WebSocket, coreId: string) {
    const core = cores.get(coreId);
    if (!core) return ws.close(4404, "core offline");
    if (core.clients.size >= maxClients) return ws.close(4429, "too many clients");
    const clientId = randomBytes(8).toString("hex");
    core.clients.set(clientId, ws);
    core.socket.send(JSON.stringify({ t: "open", c: clientId }));
    ws.send(JSON.stringify({ t: "ready" }));
    ws.on("message", (raw: RawData) => {
      const current = cores.get(coreId);
      if (!current || current.socket !== core.socket) return ws.close(4410, "core offline");
      core.socket.send(JSON.stringify({ t: "f", c: clientId, d: rawText(raw) }));
    });
    const ping = setInterval(() => (ws.readyState === WebSocket.OPEN ? ws.ping() : undefined), 25_000);
    ws.on("close", () => {
      clearInterval(ping);
      core.clients.delete(clientId);
      if (core.socket.readyState === WebSocket.OPEN) core.socket.send(JSON.stringify({ t: "close", c: clientId }));
    });
    ws.on("error", () => ws.close());
  }

  return new Promise((resolve) => {
    server.listen(opts.port ?? 0, opts.host ?? "0.0.0.0", () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        port,
        cores: () => [...cores.keys()],
        close: () =>
          new Promise((done) => {
            for (const core of cores.values()) {
              for (const c of core.clients.values()) c.close(4410, "relay stopping");
              core.socket.close(4410, "relay stopping");
            }
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
}
