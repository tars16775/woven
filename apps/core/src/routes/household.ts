import { HouseholdView, Invitation, NewInvitation, NewPerson, Person, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { HouseholdError } from "../household.ts";
import { limits } from "../auth/limits.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * The household as the Settings page sees it (phase 7). Reading is open on
 * the LAN until every screen is behind a session; changes need one.
 */
export const householdRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();

  /** Whether the box has a house yet, for the sign-in and setup pages. Nothing else without a session. */
  app.get("/household/setup", { schema: { response: { 200: z.object({ setup: z.boolean(), name: z.string().nullable() }) } } }, async () => {
    const h = app.deps.services.household.household();
    return { setup: !!h, name: h?.name ?? null };
  });
  app.get("/household", { preHandler: requireSession, schema: { response: { 200: HouseholdView } } }, async () => app.deps.services.household.view());

  app.post(
    "/household/people",
    { preHandler: requireSession, schema: { body: NewPerson, response: { 201: Person } } },
    async (req, reply) => {
      const person = app.deps.services.household.addPerson(req.body, req.session!.person);
      return reply.status(201).send(person);
    },
  );

  app.delete(
    "/household/people/:id",
    { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: Person } } },
    async (req) => app.deps.services.household.removePerson(req.params.id, req.session!.person),
  );

  app.get(
    "/household/namespaces",
    { preHandler: requireSession, schema: { response: { 200: z.object({ role: z.string(), namespaces: z.array(z.string()) }) } } },
    async (req) => {
      const { role } = req.session!.person;
      return { role, namespaces: app.deps.services.household.namespacesFor(role) };
    },
  );

  /* Invitations (phase 10) */
  app.post("/household/invitations", { preHandler: requireSession, schema: { body: NewInvitation, response: { 201: Invitation } } }, async (req, reply) =>
    reply.status(201).send(app.deps.services.invitations.create(req.body, req.session!.person)),
  );
  app.get("/household/invitations", { preHandler: requireSession, schema: { response: { 200: z.object({ invitations: z.array(Invitation) }) } } }, async (req) => ({
    invitations: app.deps.services.invitations.pending(req.session!.person.householdId),
  }));
  app.delete("/household/invitations/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: z.object({ withdrawn: z.boolean() }) } } }, async (req) => ({
    withdrawn: app.deps.services.invitations.revoke(req.params.id, req.session!.person),
  }));
  /** Whoever holds the link: learn who they are becoming and get an enrolment key for their first passkey. */
  app.post("/household/invitations/accept", { ...limits.invite, schema: { body: z.object({ token: z.string().min(10) }), response: { 200: z.object({ person: Person, household: z.string(), enrolment: z.string() }) } } }, async (req) => {
    const person = app.deps.services.invitations.accept(req.body.token);
    const enrolment = app.deps.services.enrolments.put({ personId: person.id, reason: "invitation" });
    return { person, household: app.deps.services.household.household()?.name ?? "", enrolment };
  });

  /* Data rights (phase 11) */
  app.post(
    "/household/export",
    { preHandler: requireSession, schema: { body: z.object({ scope: z.enum(["me", "household"]).default("me") }), response: { 200: z.object({ dir: z.string(), takenAt: z.string(), counts: z.record(z.string(), z.number()) }) } } },
    async (req) => app.deps.services.rights.exportData(req.session!.person, req.body.scope),
  );
  app.delete(
    "/household/people/:id/account",
    { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: z.object({ files: z.number(), objects: z.number() }) } } },
    async (req) => {
      const target = app.deps.services.household.person(req.params.id);
      if (!target || target.removedAt) throw new HouseholdError(404, "No such person.");
      return app.deps.services.rights.deleteAccount(target, req.session!.person);
    },
  );
};
