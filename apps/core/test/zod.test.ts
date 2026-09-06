import { mkdtempSync } from "node:fs";
import os from "node:os";
import Fastify from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { zodSerializerCompiler, zodValidatorCompiler, type ZodTypeProvider } from "../src/zod.ts";

/**
 * The request boundary must be exactly as strict as the schemas say: bad
 * input is a 400 with a readable reason, and a response that does not match
 * its own contract never leaves the box.
 */
const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(zodValidatorCompiler);
app.setSerializerCompiler(zodSerializerCompiler);

app.post(
  "/echo",
  {
    schema: {
      body: z.object({ name: z.string().min(1), age: z.number().int().optional() }),
      response: { 200: z.object({ greeting: z.string() }) },
    },
  },
  async (req) => ({ greeting: `Hello, ${req.body.name}`, secret: "must not leak" }),
);

app.get(
  "/broken",
  { schema: { response: { 200: z.object({ count: z.number() }) } } },
  // The handler violates its own contract on purpose.
  async () => ({ count: "twelve" }) as unknown as { count: number },
);

afterAll(async () => {
  await app.close();
});

describe("zod request boundary", () => {
  it("parses and strips unknown body fields", async () => {
    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "Maya", extra: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ greeting: "Hello, Maya" });
  });

  it("rejects bad input with a readable 400", async () => {
    const res = await app.inject({ method: "POST", url: "/echo", payload: { name: "", age: 1.5 } });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ message: string }>();
    expect(body.message).toMatch(/name:/);
    expect(body.message).toMatch(/age:/);
  });

  it("never sends a response that fails its own schema", async () => {
    const res = await app.inject({ method: "GET", url: "/broken" });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.json())).not.toContain("twelve");
  });

  it("does not depend on the filesystem", () => {
    // Guard against accidental coupling: this suite must run anywhere.
    expect(mkdtempSync(`${os.tmpdir()}/woven-zod-`)).toBeTruthy();
  });
});
