import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE, verifySignedPath, type ResolvedSession } from "./sessions.ts";

export const DEVICE_HEADER = "x-woven-device";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the session hook when the cookie names a live session. */
    session: ResolvedSession | null;
  }
}

/**
 * Resolve the session cookie on every request; routes decide whether to insist.
 * The cookie alone is not enough: the browser also holds a device secret and
 * sends it as a header, or signs the address for things it fetches without
 * headers (images, media, downloads, the event stream). Older sessions with
 * no secret keep working until they expire.
 */
export async function attachSession(req: FastifyRequest) {
  const token = req.cookies[SESSION_COOKIE];
  const session = token ? req.server.deps.services.sessions.resolve(token) : null;
  if (session?.deviceSecret) {
    const header = req.headers[DEVICE_HEADER];
    const q = req.query as Record<string, string | undefined>;
    const path = req.url.split("?")[0]!;
    const ok = (typeof header === "string" && header === session.deviceSecret) || verifySignedPath(session.deviceSecret, path, q.dexp, q.dsig);
    req.session = ok ? session : null;
    if (!ok) req.log.info({ path, hasHeader: typeof header === "string" }, "session cookie without its device secret");
    return;
  }
  req.session = session;
}

export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session) {
    await reply.status(401).send({ error: "Sign in first.", requestId: req.id });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session) return reply.status(401).send({ error: "Sign in first.", requestId: req.id });
    if (!roles.includes(req.session.person.role)) return reply.status(403).send({ error: "Not allowed for your role.", requestId: req.id });
  };
}
