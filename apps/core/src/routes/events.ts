import type { LedgerRow } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";

/**
 * Live stream of ledger rows for the dashboard: `ws(s)://core/v1/events`.
 * A client receives a hello, then one message per appended row, and a ping
 * every 30 seconds so idle connections through routers stay open.
 */
export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", { websocket: true }, (socket, req) => {
    // The stream carries every receipt title: a session is required, and browsers cannot send headers on a WebSocket, so the address is signed.
    if (!req.session) {
      socket.close(4401, "sign in first");
      return;
    }
    const { ledger } = app.deps.data;
    const send = (msg: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };
    const onAppended = (row: LedgerRow) => send({ type: "ledger", row });
    ledger.on("appended", onAppended);
    const ping = setInterval(() => send({ type: "ping", at: new Date().toISOString() }), 30_000);
    send({ type: "hello", version: app.deps.version, head: ledger.head() });
    socket.on("close", () => {
      ledger.off("appended", onAppended);
      clearInterval(ping);
    });
    socket.on("error", () => socket.close());
  });
};
