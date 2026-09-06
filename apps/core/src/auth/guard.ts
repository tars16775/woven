import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE, type ResolvedSession } from "./sessions.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the session hook when the cookie names a live session. */
    session: ResolvedSession | null;
  }
}

/** Resolve the session cookie on every request; routes decide whether to insist. */
export async function attachSession(req: FastifyRequest) {
  const token = req.cookies[SESSION_COOKIE];
  req.session = token ? req.server.deps.services.sessions.resolve(token) : null;
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
