"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export type Frameloop = "always" | "demand" | "never";

/** Device-pixel-ratio caps: the hero may go sharper, everything else stays cheap. */
export const DPR_HERO: [number, number] = [1, 1.75];
export const DPR_DEFAULT: [number, number] = [1, 1.5];

/**
 * Which render loop a scene should run: nothing while it is off-screen or the
 * tab is hidden, on-demand frames under reduced motion, continuous otherwise.
 */
export function frameloopFor(active: boolean, reduceMotion: boolean): Frameloop {
  if (!active) return "never";
  return reduceMotion ? "demand" : "always";
}

/**
 * R3F stops the loop under `frameloop="never"` and does not restart it by
 * itself when the prop flips back, so request a frame whenever it does.
 */
export function Wake() {
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (frameloop !== "never") invalidate();
  }, [frameloop, invalidate]);
  return null;
}
