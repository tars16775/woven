import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";

/**
 * Who sent this, if anyone. The site signs people in with Supabase Auth and
 * sends the access token along; we check its signature against the project's
 * published keys and take the subject. Anything that does not verify is
 * simply nobody, which is what an unsigned request is too: the API accepts
 * reservations from strangers on purpose, it just cannot attach them to an
 * account.
 */
export type VerifyUser = (authorization: string | undefined) => Promise<string | null>;

export type VerifierOptions = {
  /** e.g. https://<ref>.supabase.co */
  url: string;
  /** Defaults to the project's own JWKS endpoint. */
  jwksUrl?: string;
  fetcher?: typeof fetch;
};

export function createVerifier(opts: VerifierOptions): VerifyUser {
  const base = opts.url.replace(/\/+$/, "");
  const jwks = createRemoteJWKSet(new URL(opts.jwksUrl ?? `${base}/auth/v1/.well-known/jwks.json`), opts.fetcher ? { [customFetch]: opts.fetcher } : {});
  return async (authorization) => {
    const token = /^Bearer (.+)$/i.exec(authorization ?? "")?.[1];
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: `${base}/auth/v1`, audience: "authenticated" });
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  };
}
