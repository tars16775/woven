import { SESSION_COOKIE } from "../src/auth/sessions.ts";

/** A signed-in device in tests: the cookie and the device secret the core hands over once. */
export type Auth = { cookie: string; device: string };

export function sessionOf(res: { headers: Record<string, unknown> }): Auth {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const list: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = list.find((x) => x.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ?? "";
  const device = typeof res.headers["x-woven-device-secret"] === "string" ? res.headers["x-woven-device-secret"] : "";
  return { cookie, device };
}

/** Headers for a request from that device. */
export function auth(a: Auth | string): Record<string, string> {
  if (typeof a === "string") return a ? { cookie: a } : {};
  return { cookie: a.cookie, "x-woven-device": a.device };
}
