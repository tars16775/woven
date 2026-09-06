import type { FastifySchemaCompiler, FastifySerializerCompiler, FastifyTypeProvider } from "fastify";
import { z, type ZodType } from "zod";

/**
 * Fastify's validation and serialisation, backed by Zod schemas from
 * `@woven/schema`. Written here rather than pulled in as a dependency so the
 * request boundary is code we own and can read.
 */

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this["schema"] extends ZodType ? z.output<this["schema"]> : unknown;
  serializer: this["schema"] extends ZodType ? z.input<this["schema"]> : unknown;
}

const isZod = (s: unknown): s is ZodType => typeof s === "object" && s !== null && "_zod" in s;

/** Body, params, querystring and headers are parsed; unknown keys are stripped by the schema. */
export const zodValidatorCompiler: FastifySchemaCompiler<ZodType> = ({ schema }) => {
  return (data) => {
    const result = schema.safeParse(data);
    if (result.success) return { value: result.data };
    const message = result.error.issues
      .map((i) => `${i.path.map(String).join(".") || "value"}: ${i.message}`)
      .join("; ");
    const error = new Error(message) as Error & { statusCode: number; validation: unknown };
    error.statusCode = 400;
    error.validation = result.error.issues;
    return { error };
  };
};

/**
 * Responses are parsed through their schema before they leave, so a route can
 * never send a field the contract does not name. A response that fails its
 * own schema is a bug and surfaces as a 500, never as leaked data.
 */
export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> = ({ schema }) => {
  return (data) => {
    if (!isZod(schema)) return JSON.stringify(data);
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`response does not match its schema: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    }
    return JSON.stringify(result.data);
  };
};

/** "true"/"false"/"1"/"0" from a query string, as a boolean. z.coerce.boolean would make "false" true. */
export const QueryBool = (fallback: boolean) => z.preprocess((v) => (v === undefined ? fallback : v === true || v === "true" || v === "1"), z.boolean());

