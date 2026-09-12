/**
 * The public site's backend (gap 8). Reservations and applications stay on
 * this device as they always did; when the site API address is set, they
 * are also sent there so a person hears back by email. Best effort: a
 * failed send never blocks the person, and the local copy is the truth
 * they hold.
 */
import { accessToken } from "./supabase";

export const SITE_API = process.env.NEXT_PUBLIC_SITE_API?.replace(/\/+$/, "") ?? "";

export type SendResult = { sent: boolean; mail?: string; reason?: string };

async function send(path: string, body: unknown): Promise<SendResult> {
  if (!SITE_API) return { sent: false, reason: "no site API configured" };
  try {
    // Signed in to a Woven account? Then this is theirs, and their account
    // page will show it. Not signed in is fine too; the address they gave
    // still finds it later.
    const token = await accessToken().catch(() => null);
    const res = await fetch(`${SITE_API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { sent: false, reason: `HTTP ${res.status}` };
    const j = (await res.json()) as { mail?: string };
    return { sent: true, ...(j.mail ? { mail: j.mail } : {}) };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "network" };
  }
}

export const siteApi = {
  reservation: (r: { code: string; tier: string; finish: string; storage: string; cloud: string; addons: string[]; total: number; deposit: number; name?: string; email?: string }) => send("/reservations", r),
  application: (a: { code: string; name: string; email: string; city: string; people: string; setup: string[]; why: string }) => send("/applications", a),
  contact: (c: { email: string; message: string }) => send("/contact", c),
};
