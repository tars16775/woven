"use client";

import Link from "next/link";
import { useCore } from "@/lib/core/store";

/**
 * The demonstration label (phase 9).
 *
 * A demo is a real Core with an example household on it, not a fake dashboard
 * in the browser. That is the whole design: the software cannot tell the
 * difference, so nothing in the product needs a pretend mode, and the one
 * thing that could go wrong — somebody mistaking a demo for their own house —
 * is answered by a label that is present on every screen and cannot be
 * dismissed.
 *
 * The flag is set by whoever runs that Core (`WOVEN_DEMO=on`). It is never
 * inferred from the data: a house that happens to look like an example is
 * still somebody's house.
 */
export function useIsDemo(): boolean {
  const core = useCore();
  return core.phase === "connected" && core.status?.demo === true;
}

export function DemoBanner() {
  const demo = useIsDemo();
  if (!demo) return null;

  return (
    <div
      role="note"
      aria-label="Demonstration household"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-ask-bg px-4 py-1.5 text-center text-[12px] text-ask"
      data-testid="demo-banner"
    >
      <span className="font-medium">This is a demonstration household.</span>
      <span>The software is real and so is the ledger. The people, files and devices are examples, and anyone can change them.</span>
      <Link href="/mac" className="font-medium underline underline-offset-2">
        Run your own
      </Link>
    </div>
  );
}
