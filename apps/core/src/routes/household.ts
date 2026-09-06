import { HouseholdView, NewPerson, Person, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * The household as the Settings page sees it (phase 7). Reading is open on
 * the LAN until every screen is behind a session; changes need one.
 */
export const householdRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();

  app.get("/household", { schema: { response: { 200: HouseholdView } } }, async () => app.deps.services.household.view());

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
};
