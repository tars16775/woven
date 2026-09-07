"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Whether this person asked for less movement, in a form that is safe to
 * branch a rendered tree on.
 *
 * The obvious hook answers differently on the server and on the first client
 * paint, so any component that changes its markup based on it hydrates into a
 * mismatch, and React throws the tree away and rebuilds it. This one answers
 * false until after mount, so the first client render is identical to the
 * server's; the real answer arrives a tick later and the component settles.
 */
export function useReducedMotionAfterMount(): boolean {
  // The server snapshot is also what React uses for the hydrating render, so
  // the first client paint matches the server's exactly.
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
