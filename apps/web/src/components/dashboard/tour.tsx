"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth";
import { markSeen } from "@/lib/dashboard/guide";
import { IconChevron, IconX } from "./icons";

/**
 * The walkthrough (phase 7).
 *
 * Deliberately not coach marks. A tooltip pinned to an element breaks the
 * moment the layout moves, fights the scroll position, and cannot survive a
 * route change — and a tour of a house has to walk between rooms. This walks
 * instead: it navigates to each room and puts one sentence in a bar at the
 * bottom of the window, out of the way of the thing it is describing.
 *
 * The bar is a real landmark with real buttons, so it is reachable by keyboard
 * and readable by a screen reader, and it can be left at any step.
 */

export type TourStep = { href: string; title: string; body: string };

export const steps: TourStep[] = [
  {
    href: "/dashboard",
    title: "Overview",
    body: "What the house is doing right now: what is running, what needs a look, and what crossed the Gate today.",
  },
  {
    href: "/dashboard/files",
    title: "Files",
    body: "Everything you put in, stored once and encrypted on the drive. Devices back up here; nothing is copied to anyone else's computer.",
  },
  {
    href: "/dashboard/home",
    title: "Home",
    body: "Lights, plugs and locks. A light is immediate. A lock asks first, and either way a receipt says who asked and what the device reported back.",
  },
  {
    href: "/dashboard/network",
    title: "The Gate",
    body: "The only way anything leaves. It asks before each crossing, records what was sent, and closes completely when you tell it to.",
  },
  {
    href: "/dashboard/activity",
    title: "Your record",
    body: "Every consequential act, in order, chained to the one before it. Open any line to see what was planned, what happened, and who said yes.",
  },
  {
    href: "/dashboard/core",
    title: "The box",
    body: "The machine itself: its drives, its release, and the switch that turns everything off. Nothing here reaches past your own network.",
  },
];

/* Module store: the tour outlives a route change, so it cannot live in a page. */
let step: number | null = null;
const listeners = new Set<() => void>();

function set(next: number | null) {
  step = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function startTour() {
  set(0);
}
export function stopTour() {
  set(null);
}
export function useTourStep(): number | null {
  return useSyncExternalStore(subscribe, () => step, () => null);
}

export function TourBar() {
  const at = useTourStep();
  const router = useRouter();
  const session = useSession();
  if (at === null) return null;

  const current = steps[at];
  if (!current) return null;

  const finish = () => {
    markSeen(session?.personId, "tour");
    markSeen(session?.personId, "welcome");
    stopTour();
  };

  const go = (next: number) => {
    if (next < 0 || next >= steps.length) return finish();
    set(next);
    router.push(steps[next]!.href);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <aside
        aria-label="Walkthrough"
        className="dash-panel dash-lock pointer-events-auto flex w-full max-w-[720px] flex-col gap-3 rounded-[16px] bg-graphite p-4 text-bone shadow-[var(--shadow-sheet)] ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-2">
            <span>
              Step {at + 1} of {steps.length}
            </span>
            <span aria-hidden className="flex gap-1">
              {steps.map((s, i) => (
                <span key={s.href} className={`block h-[3px] w-4 rounded-full ${i <= at ? "bg-amber" : "bg-white/20"}`} />
              ))}
            </span>
          </div>
          <div className="mt-1.5 text-[15px] font-medium">{current.title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ash-2">{current.body}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            aria-label="Previous step"
            className="tap rounded-[8px] p-2 text-ash-2 hover:bg-white/10 hover:text-bone disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconChevron dir="left" size={18} />
          </button>
          <button
            type="button"
            onClick={() => go(at + 1)}
            className="tap rounded-[8px] bg-amber px-4 py-2 text-[13px] font-medium text-[#1a1a1a] hover:bg-amber-2"
          >
            {at === steps.length - 1 ? "Done" : "Next"}
          </button>
          <button
            type="button"
            onClick={finish}
            aria-label="Leave the walkthrough"
            className="tap rounded-[8px] p-2 text-ash-2 hover:bg-white/10 hover:text-bone"
          >
            <IconX size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}
