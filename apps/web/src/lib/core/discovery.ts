/**
 * Finding the Core on the home network.
 *
 * The browser cannot browse mDNS itself, so the site tries the household
 * name the core advertises (woven.local) and the local machine, remembers
 * what answered, and lets a person type an address when nothing does.
 *
 * NEXT_PUBLIC_WOVEN_LIVE: "on" (default) probes; "off" never touches the
 * network and the dashboard says no Core is answering. The marketing deploy uses off.
 */

export const LIVE = process.env.NEXT_PUBLIC_WOVEN_LIVE !== "off";

const REMEMBERED = "woven:core";

export function defaultCandidates(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_WOVEN_CORE_URL?.trim();
  // Served by the Core itself (the installed service): the page's own origin answers first.
  const own = typeof window !== "undefined" && window.location.port !== "3000" && /^https?:$/.test(window.location.protocol) ? window.location.origin : null;
  const list = [
    ...(own ? [own] : []),
    ...(fromEnv ? [fromEnv] : []),
    "https://woven.local:4000",
    "https://localhost:4000",
    // The core's loopback listener (same machine, no certificate needed) and a TLS-off core.
    "http://localhost:4002",
    "http://localhost:4000",
  ];
  return [...new Set(list.map(normalize))];
}

export function normalize(url: string): string {
  const raw = url.trim();
  // Two different things arrive here. A bare name or address is somebody
  // naming their box: it speaks HTTPS on 4000, so say so for them. A full URL
  // is somebody being exact — a Core on another port, or one reached through
  // a proxy on another site's path — and the one thing that must not happen
  // is helpfully appending a port to an address that was already complete.
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  const host = raw.replace(/\/+$/, "");
  return /:\d+$/.test(host) || host.includes("/") ? `https://${host}` : `https://${host}:4000`;
}


export function remembered(): string | null {
  try {
    return localStorage.getItem(REMEMBERED);
  } catch {
    return null;
  }
}

export function remember(url: string | null) {
  try {
    if (url) localStorage.setItem(REMEMBERED, url);
    else localStorage.removeItem(REMEMBERED);
  } catch {}
}

export type Probe = { ok: true; version: string } | { ok: false; reason: string };

/** One health check with a short deadline; never throws. */
export async function probe(base: string, timeoutMs = 2500, fetcher: typeof fetch = fetch): Promise<Probe> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(`${base}/v1/health`, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; version?: string };
    if (body.ok !== true || typeof body.version !== "string") return { ok: false, reason: "not a Woven Core" };
    return { ok: true, version: body.version };
  } catch (err) {
    return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "no answer" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Try the remembered address first, then every candidate at once; the first Core wins. */
export async function discover(candidates = defaultCandidates(), fetcher: typeof fetch = fetch): Promise<string | null> {
  const first = remembered();
  const order = first ? [first, ...candidates.filter((c) => c !== first)] : candidates;
  const results = await Promise.all(order.map(async (base) => ({ base, probe: await probe(base, 2500, fetcher) })));
  const hit = results.find((r) => r.probe.ok);
  return hit ? hit.base : null;
}
