"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (gap 16) when the dashboard is served over
 * HTTPS or from localhost by a Core; the marketing deploy and the dev
 * server skip it. Install prompts are the browser's own.
 */
export function Pwa() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NEXT_PUBLIC_WOVEN_LIVE === "off") return;
    if (window.location.port === "3000") return; // next dev
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
