"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Copy and product art rise a little as they come into view.
 *
 * The rule this component exists to keep: nothing is ever hidden by an
 * animation that might not run. The markup is identical on the server and
 * the client, so hydration cannot mismatch; the hidden state is only ever
 * applied by JavaScript after mount, and a failsafe reveals everything a
 * second and a half later whether the observer fired or not. Without
 * JavaScript, or with reduced motion, the content is simply there.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen at first paint: leave it alone rather than flash it away.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) return;

    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    // Whatever happens to the observer, the content appears.
    const failsafe = setTimeout(() => setState("shown"), 1500);
    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={ref} data-reveal={state === "static" ? undefined : state} style={delay && state !== "static" ? { transitionDelay: `${delay}s` } : undefined} className={className}>
      {children}
    </div>
  );
}
