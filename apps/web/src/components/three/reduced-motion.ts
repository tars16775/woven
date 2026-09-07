"use client";

import { useEffect, useState } from "react";

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
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
