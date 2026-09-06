import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

/**
 * Throttles on the doors (phase A, gap 2): sign-in, recovery, the screen
 * code, invitations. Keyed by the caller's address and, where there is
 * one, the email in the body, so one guest on the Wi-Fi cannot guess
 * against everyone. Tripping a throttle is itself a receipt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the plugin is typed against the default provider; our instance carries the Zod one
export async function registerLimits(app: FastifyInstance<any, any, any, any, any>, onExceeded: (route: string, key: string) => void) {
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => {
      const body = req.body as { email?: string; name?: string } | undefined;
      const who = (body?.email ?? body?.name ?? "").toString().toLowerCase().slice(0, 80);
      return `${req.ip}|${who}`;
    },
    onExceeded: (req, key) => onExceeded(req.routeOptions.url ?? req.url, key),
    errorResponseBuilder: (_req, ctx) => ({ error: `Too many attempts. Try again in ${Math.ceil(ctx.ttl / 1000)} seconds.`, statusCode: 429 }),
  });
}

/** Per-route settings: a handful of tries a minute is plenty for a person and useless for a guesser. */
export const limits = {
  signIn: { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
  recovery: { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
  code: { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
  invite: { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
  setup: { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } },
} as const;
