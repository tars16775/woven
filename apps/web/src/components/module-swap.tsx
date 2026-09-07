"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { InsideDiagram } from "./three/canvas-fallbacks";
import { CanvasStage } from "./three/canvas-stage";
import { useReducedMotionAfterMount } from "./three/reduced-motion";

const InsideScene = dynamic(() => import("./three/inside-scene"), { ssr: false, loading: () => null });

const captions = [
  ["Power down.", "The screen says so. Household storage locks itself."],
  ["Lift the lid. Pull the module.", "One handle, no tools. Drives, radios and keys stay where they are."],
  ["Seat the new one.", "The chassis checks its identity and power before anything unlocks."],
  ["Everything is still here.", "Files, users, devices, automations, receipts. Nothing to re-pair."],
] as const;

const description =
  "An exploded view of the Woven Core chassis, told in four steps as the page scrolls. The bone-white lid lifts off and " +
  "fades, showing the inside: two drive sleds on the left, three small radios and a gold secure element along the back, " +
  "and the compute module in its bay. The module slides out to the right by its handle while an amber line marks the " +
  "drives, radios and keys that stay in place. A new module, Compute Module B2 with 128 GB, slides in from the right and " +
  "seats on the connector. Everything is still there: files, users, devices, automations and receipts.";

function ramp(p: number, a: number, b: number, from: number, to: number) {
  if (p <= a) return from;
  if (p >= b) return to;
  return from + ((p - a) / (b - a)) * (to - from);
}

type Props = {
  /** Where the Skip link lands. */
  skipHref?: string;
};

/**
 * Scroll-driven exploded view of the chassis. Progress is measured from the
 * section's own position, written to a ref the WebGL scene reads every
 * frame, and mirrored to state only for the captions.
 */
export function ModuleSwap({ skipHref = "#privacy" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const reduce = useReducedMotionAfterMount();
  const [p, setP] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      const next = range <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / range));
      progress.current = next;
      setP((prev) => (Math.abs(prev - next) > 0.004 ? next : prev));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);

  const captionOpacity = [
    p < 0.22 ? 1 : ramp(p, 0.22, 0.28, 1, 0),
    ramp(p, 0.25, 0.3, 0, 1) * ramp(p, 0.55, 0.6, 1, 0),
    ramp(p, 0.58, 0.63, 0, 1) * ramp(p, 0.85, 0.9, 1, 0),
    ramp(p, 0.88, 0.93, 0, 1),
  ];

  const scene = (
    <CanvasStage className="h-full w-full" label="Swapping the compute module, exploded view of the chassis" description={description} fallback={<InsideDiagram />}>
      {(active) => <InsideScene progress={progress} reduceMotion={reduce} active={active} />}
    </CanvasStage>
  );

  if (reduce) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-16 lg:px-10">
        <div className="h-[56svh] max-h-[620px] w-full">{scene}</div>
        <p className="mx-auto mt-8 max-w-[520px] text-center text-[15px] text-ash">
          {captions[3][0]} {captions[3][1]}
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[220svh] max-sm:h-[180svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center px-6">
        <div className="h-[56svh] max-h-[640px] w-full max-w-[1100px]">{scene}</div>
        <div className="relative mt-4 h-[96px] w-full max-w-[560px] px-2 text-center sm:h-[72px]">
          {captions.map(([t, d], i) => (
            <div key={t} style={{ opacity: captionOpacity[i] }} className="absolute inset-0">
              <div className="font-display text-[22px] font-medium tracking-[-0.02em] md:text-[26px]">{t}</div>
              <div className="mt-1.5 text-[14px] text-ash">{d}</div>
            </div>
          ))}
        </div>
        <a
          href={skipHref}
          className="absolute bottom-5 right-5 inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-bone/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ash backdrop-blur transition-colors hover:border-ink/30 hover:text-ink sm:bottom-7 sm:right-8"
        >
          Skip<span className="sr-only"> the exploded view</span>
          <span aria-hidden="true">↓</span>
        </a>
      </div>
    </div>
  );
}
