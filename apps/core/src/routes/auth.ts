import { DeviceToken, Household, Person, ScreenState, SessionView, SetupHousehold } from "@woven/schema";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireRole, requireSession } from "../auth/guard.ts";
import { PasskeyError } from "../auth/passkeys.ts";
import { SESSION_COOKIE, sessionCookie } from "../auth/sessions.ts";
import { screenPage } from "../auth/screen.ts";
import { limits } from "../auth/limits.ts";
import type { ZodTypeProvider } from "../zod.ts";

const Options = z.object({ key: z.string(), options: z.record(z.string(), z.unknown()) });
const Credential = z.record(z.string(), z.unknown());
const Passkey = z.object({ id: z.string(), credentialId: z.string(), label: z.string().nullable(), createdAt: z.string(), lastUsedAt: z.string().nullable(), transports: z.array(z.string()) });

/**
 * Identity (phase 8). Setting up the house and registering its first passkey,
 * signing in with a passkey, recovery codes, and the device session cookie.
 * Everything here is LAN-only by where the core listens and CORS-bound to the
 * dashboard origins; the rpID is derived from the calling origin.
 */
export const authRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services, config } = app.deps;

  const deviceLabel = (req: FastifyRequest) => (req.headers["user-agent"] ?? "").toString().slice(0, 120) || null;
  const secure = () => Boolean(app.deps.tls) || config.env !== "production";
  /** Issue a session for this device, set the cookie, and make the request carry it so the handler can answer with it. */
  const setSession = (reply: FastifyReply, person: Person, method: "passkey" | "code" | "recovery", req: FastifyRequest) => {
    const issued = services.sessions.issue(person, method, deviceLabel(req));
    const c = sessionCookie(issued.token, issued.expiresAt, { secure: secure() });
    void reply.setCookie(c.name, c.value, c.options);
    req.session = services.sessions.resolve(issued.token);
    // The device secret goes to the page once, in the body; the browser keeps it outside the cookie jar.
    void reply.header("x-woven-device-secret", issued.deviceSecret);
    return issued;
  };
  const view = (req: FastifyRequest): SessionView => {
    const s = req.session!;
    return SessionView.parse({
      person: s.person,
      household: services.household.household(),
      method: s.method,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      passkeys: services.passkeys.count(s.personId),
    });
  };

  /** First run: create the household and its owner; hand back an enrolment key for the owner's first passkey, plus recovery codes shown once. */
  app.post(
    "/household/setup",
    {
      ...limits.setup,
      schema: {
        body: SetupHousehold,
        response: { 201: z.object({ household: Household, owner: Person, enrolment: z.string(), recoveryCodes: z.array(z.string()) }) },
      },
    },
    async (req, reply) => {
      const { household, owner } = services.household.setup(req.body);
      services.routines.ensureStarters(owner);
      const recoveryCodes = services.recovery.issue(owner);
      const enrolment = services.enrolments.put({ personId: owner.id, reason: "setup" });
      return reply.status(201).send({ household, owner, enrolment, recoveryCodes });
    },
  );

  /** Registration options: for yourself (session) or for a person named by an enrolment key. */
  app.post(
    "/auth/passkeys/register/options",
    { ...limits.signIn, schema: { body: z.object({ enrolment: z.string().optional() }), response: { 200: Options } } },
    async (req) => {
      const personId = req.session?.personId ?? services.enrolments.peek(req.body.enrolment)?.personId;
      if (!personId) throw new PasskeyError(401, "Sign in, or use the link you were given.");
      const person = services.household.person(personId);
      if (!person || person.removedAt) throw new PasskeyError(401, "That person is no longer in the household.");
      const { key, options } = await services.passkeys.registrationOptions(person, req.headers.origin);
      return { key, options: { ...options } };
    },
  );

  app.post(
    "/auth/passkeys/register/verify",
    {
      schema: {
        body: z.object({ key: z.string(), credential: Credential, label: z.string().max(60).optional(), enrolment: z.string().optional() }),
        response: { 200: z.object({ passkey: Passkey, session: SessionView }) },
      },
    },
    async (req, reply) => {
      const { personId, passkey } = await services.passkeys.verifyRegistration(req.body.key, req.body.credential as never, req.body.label ?? null);
      if (!req.session) {
        // A first passkey through an enrolment key signs the device in; the key is spent.
        const enrolment = services.enrolments.take(req.body.enrolment);
        if (!enrolment || enrolment.personId !== personId) throw new PasskeyError(401, "That enrolment is no longer valid.");
        const person = services.household.person(personId)!;
        setSession(reply, person, "passkey", req);
      }
      return { passkey, session: view(req) };
    },
  );

  app.post(
    "/auth/passkeys/login/options",
    { ...limits.signIn, schema: { body: z.object({ email: z.email().optional() }), response: { 200: Options } } },
    async (req) => {
      const person = req.body.email ? services.household.personByEmail(req.body.email) : null;
      if (req.body.email && !person) throw new PasskeyError(401, "No one in this household has that email.");
      const { key, options } = await services.passkeys.authenticationOptions(person, req.headers.origin);
      return { key, options: { ...options } };
    },
  );

  app.post(
    "/auth/passkeys/login/verify",
    { ...limits.signIn, schema: { body: z.object({ key: z.string(), credential: Credential }), response: { 200: SessionView } } },
    async (req, reply) => {
      const personId = await services.passkeys.verifyAuthentication(req.body.key, req.body.credential as never);
      const person = services.household.person(personId);
      if (!person || person.removedAt) throw new PasskeyError(401, "That person is no longer in the household.");
      setSession(reply, person, "passkey", req);
      return view(req);
    },
  );

  /** Lost every device: a recovery code signs you in once so you can add a passkey. */
  app.post(
    "/auth/recover",
    { ...limits.recovery, schema: { body: z.object({ email: z.email(), code: z.string().min(8).max(12) }), response: { 200: SessionView } } },
    async (req, reply) => {
      const person = services.household.personByEmail(req.body.email);
      if (!person || !services.recovery.redeem(person, req.body.code)) throw new PasskeyError(401, "That code did not match.");
      setSession(reply, person, "recovery", req);
      return view(req);
    },
  );

  /**
   * The code on the screen (phase 9). The screen itself is only served to the
   * machine's own display (loopback); entering its code with your name from
   * any device on the home network signs that device in as you.
   */
  const loopbackOnly = async (req: FastifyRequest, reply: FastifyReply) => {
    const addr = req.socket.remoteAddress ?? "";
    if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(addr)) await reply.status(404).send({ error: "Nothing at this address on the box.", requestId: req.id });
  };
  app.get("/screen", { preHandler: loopbackOnly }, async (_req, reply) =>
    reply.type("text/html; charset=utf-8").header("cache-control", "no-store").send(screenPage(config.name, services.household.household()?.name ?? null)),
  );
  app.get("/screen/code", { preHandler: loopbackOnly, schema: { response: { 200: z.object({ code: z.string().length(6), secondsLeft: z.number().int() }) } } }, async () => services.screen.current());
  app.get("/screen/state", { preHandler: loopbackOnly, schema: { response: { 200: ScreenState } } }, async () => {
    const h = services.household.household();
    const titles: Record<string, string> = { "core.started": "Core started", "core.integrity_checked": "Ledger verified", "action.executed": "Action ran", "action.prepared": "Waiting for a yes", "action.approved": "Approved", "action.declined": "Declined", "action.failed": "Action failed", "gate.crossing": "Crossing", "gate.closed": "Gate closed", "gate.opened": "Gate opened", "session.started": "Signed in", "session.ended": "Signed out", "person.created": "Person added", "person.removed": "Person removed", "household.created": "House set up", "memory.created": "Memory kept", "memory.deleted": "Memory forgotten" };
    const alerts = services.alerts.list();
    return ScreenState.parse({
      household: h?.name ?? null,
      name: config.name,
      state: alerts.some((a) => a.level === "urgent") ? "attention" : "ready",
      ...services.screen.current(),
      presence: services.presence.get().adultsHome,
      gate: services.gate.cached().state,
      camerasPaused: false,
      activity: app.deps.data.ledger.recent(undefined, 6).map((r) => ({ at: r.occurredAt, title: titles[r.type] ?? r.type, where: r.where })),
      alerts,
      pendingApprovals: h ? services.actions.list(h.id, "prepared").length : 0,
    });
  });

  app.post(
    "/auth/code/login",
    { ...limits.code, schema: { body: z.object({ name: z.string().trim().min(1).max(80), code: z.string().min(6).max(7) }), response: { 200: SessionView } } },
    async (req, reply) => {
      const h = services.household.household();
      if (!h) throw new PasskeyError(401, "This box has no house yet.");
      const person = services.household.people(h.id).find((p) => p.name.toLowerCase() === req.body.name.toLowerCase());
      if (!person) throw new PasskeyError(401, "No one in the house goes by that name. Ask the owner to add you first.");
      if (!services.screen.verify(req.body.code)) throw new PasskeyError(401, "That code did not match the screen. It changes every minute.");
      setSession(reply, person, "code", req);
      return view(req);
    },
  );

  app.get("/auth/session", { preHandler: requireSession, schema: { response: { 200: SessionView } } }, async (req) => view(req));

  app.get("/auth/passkeys", { preHandler: requireSession, schema: { response: { 200: z.object({ passkeys: z.array(Passkey), recoveryCodesLeft: z.number().int() }) } } }, async (req) => ({
    passkeys: services.passkeys.list(req.session!.personId),
    recoveryCodesLeft: services.recovery.remaining(req.session!.person),
  }));

  app.delete(
    "/auth/passkeys/:id",
    { preHandler: requireSession, schema: { params: z.object({ id: z.string() }), response: { 200: z.object({ removed: z.boolean() }) } } },
    async (req) => {
      if (services.passkeys.count(req.session!.personId) <= 1) throw new PasskeyError(400, "Keep at least one passkey, or you will be locked out.");
      return { removed: services.passkeys.revoke(req.session!.personId, req.params.id) };
    },
  );

  app.post("/auth/recovery-codes", { preHandler: requireSession, schema: { response: { 200: z.object({ recoveryCodes: z.array(z.string()) }) } } }, async (req) => ({
    recoveryCodes: services.recovery.issue(req.session!.person),
  }));

  app.post("/auth/logout", { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) services.sessions.revoke(token);
    void reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true as const };
  });

  /* Device tokens (gap 20): a year-long credential for a backup client, shown once. */
  app.post(
    "/auth/tokens",
    { preHandler: requireRole("owner", "adult"), schema: { body: z.object({ label: z.string().trim().min(1).max(80) }), response: { 201: DeviceToken.extend({ token: z.string() }) } } },
    async (req, reply) => {
      const issued = services.sessions.issue(req.session!.person, "token", req.body.label);
      return reply.status(201).send({ id: issued.id, label: req.body.label, createdAt: new Date().toISOString(), expiresAt: issued.expiresAt, token: `${issued.token}.${issued.deviceSecret}` });
    },
  );
  app.get("/auth/tokens", { preHandler: requireSession, schema: { response: { 200: z.object({ tokens: z.array(DeviceToken) }) } } }, async (req) => ({ tokens: services.sessions.tokens(req.session!.person) }));
  app.delete("/auth/tokens/:id", { preHandler: requireSession, schema: { params: z.object({ id: z.string() }), response: { 200: z.object({ revoked: z.boolean() }) } } }, async (req) => ({
    revoked: services.sessions.revokeById(req.session!.person, req.params.id),
  }));

  app.post("/auth/logout-others", { preHandler: requireSession, schema: { response: { 200: z.object({ signedOut: z.number().int() }) } } }, async (req) => ({
    signedOut: services.sessions.revokeOthers(req.session!.person, req.session!.id),
  }));
};
