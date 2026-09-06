"use client";

import { useEffect, useState } from "react";
import { deviceHeaders } from "./device";
import { REMOTE_BASE } from "./remote";
import { coreState } from "./store";

/**
 * One way to reach the Core from every API module: over the home network
 * with the session cookie, or, away from home, through the relay tunnel
 * with the pairing's token sealed inside each frame. Callers pass a path;
 * they never learn which.
 */
export function coreFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const state = coreState();
  if (state.phase !== "connected") return Promise.reject(new Error("no Core connected"));
  if (state.remote) {
    // Through the tunnel: the session inside is the pairing's token; the device header is meaningless there.
    return state.remote.fetch(path, init);
  }
  return fetch(`${state.url}${path}`, { ...init, credentials: "include", headers: { ...deviceHeaders(), ...(init.headers ?? {}) } });
}

/** True when the dashboard reaches its Core through the relay. */
export function isRemote(): boolean {
  const s = coreState();
  return s.phase === "connected" && !!s.remote;
}

export function isRemoteUrl(url: string): boolean {
  return url.startsWith(REMOTE_BASE);
}

/** The path behind a remote address, for fetching through the tunnel. */
export function remotePath(url: string): string {
  return url.slice(REMOTE_BASE.length).replace(/[?&]dexp=\d+&dsig=[^&]*/g, "");
}

const objectUrls = new Map<string, Promise<string>>();

/**
 * An address a browser element can use. On the home network that is the
 * signed URL itself. Through the relay the bytes are fetched in the tunnel
 * once and handed over as an object URL; the small cache keeps a grid of
 * thumbnails from re-fetching.
 */
export function useCoreUrl(url: string | null): string | null {
  const [fetched, setFetched] = useState<{ url: string; object: string } | null>(null);
  useEffect(() => {
    if (!url || !isRemoteUrl(url)) return;
    let alive = true;
    let p = objectUrls.get(url);
    if (!p) {
      p = coreFetch(remotePath(url))
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return URL.createObjectURL(await r.blob());
        })
        .catch((err: unknown) => {
          objectUrls.delete(url);
          throw err;
        });
      objectUrls.set(url, p);
      if (objectUrls.size > 300) {
        const first = objectUrls.keys().next().value;
        if (first) {
          void objectUrls.get(first)?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
          objectUrls.delete(first);
        }
      }
    }
    p.then((u) => alive && setFetched({ url, object: u })).catch(() => alive && setFetched(null));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url) return null;
  if (!isRemoteUrl(url)) return url;
  return fetched && fetched.url === url ? fetched.object : null;
}

/** Open or save a file through the tunnel when away; a plain link at home. */
export async function openCoreUrl(url: string, opts: { download?: string } = {}): Promise<void> {
  if (!isRemoteUrl(url)) {
    if (opts.download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = opts.download;
      a.click();
    } else window.open(url, "_blank", "noopener");
    return;
  }
  const r = await coreFetch(remotePath(url));
  if (!r.ok) throw new Error(`The Core answered ${r.status}.`);
  const blobUrl = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  if (opts.download) a.download = opts.download;
  else a.target = "_blank";
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
