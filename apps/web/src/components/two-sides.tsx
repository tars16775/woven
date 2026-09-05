"use client";

import { useState } from "react";
import { sides } from "@/lib/site";

const crossings = [
  ["09:30", "Crossing", "Deep research · approved by Alex · 1 task out, 1 answer in"],
  ["07:00", "Update", "Woven OS 0.4.1 · signature verified on the Outside, installed Inside"],
  ["Yesterday", "Your key", "Alex reached Files from the office · nothing stored outside"],
];

/**
 * The architecture as a diagram: two computers in one box, and the narrow
 * gate between them. Everything of yours is on the left. The internet is
 * on the right. The visitor can open the gate's log.
 */
export function TwoSides() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-[1100px]">
      <div className="grid gap-3 md:grid-cols-[1.15fr_0.55fr_1fr]">
        {/* Inside */}
        <div className="rounded-[18px] bg-graphite-2 p-6 text-bone ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="font-display text-[24px] font-medium tracking-[-0.02em]">{sides.inside.title}</div>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
              <span className="orb" style={{ ["--orb" as string]: "7px" }} />
              no internet
            </span>
          </div>
          <p className="mt-1 text-[14px] text-ash-2">{sides.inside.line}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {sides.inside.items.map((it) => (
              <li key={it} className="rounded-[10px] bg-white/5 px-3.5 py-2.5 text-[13.5px]">
                {it}
              </li>
            ))}
          </ul>
        </div>

        {/* Gate */}
        <div className="relative flex flex-col justify-between rounded-[18px] border border-amber/50 bg-amber/8 p-5 text-bone">
          <div>
            <div className="font-display text-[20px] font-medium tracking-[-0.02em] text-amber-2">{sides.gate.title}</div>
            <p className="mt-1 text-[13px] text-bone/80">{sides.gate.line}</p>
          </div>
          <ul className="mt-5 space-y-2 text-[13px] text-bone/85">
            {sides.gate.items.map((it) => (
              <li key={it} className="flex items-start gap-2">
                <span className="mt-[7px] block h-[5px] w-[5px] shrink-0 rounded-full bg-amber-2" />
                {it}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-5 rounded-[8px] bg-amber px-3 py-2 text-[13px] font-medium text-ink hover:bg-amber-2"
          >
            {open ? "Hide today's crossings" : "Show today's crossings"}
          </button>
        </div>

        {/* Outside */}
        <div className="rounded-[18px] bg-bone p-6 text-ink">
          <div className="flex items-center justify-between">
            <div className="font-display text-[24px] font-medium tracking-[-0.02em]">{sides.outside.title}</div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash">internet</span>
          </div>
          <p className="mt-1 text-[14px] text-ash">{sides.outside.line}</p>
          <ul className="mt-5 grid gap-2">
            {sides.outside.items.map((it) => (
              <li key={it} className="rounded-[10px] bg-white px-3.5 py-2.5 text-[13.5px] ring-1 ring-ink/5">
                {it}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-[14px] bg-graphite-2 ring-1 ring-white/10">
          {crossings.map(([t, k, d]) => (
            <div key={t + k} className="grid grid-cols-[84px_100px_1fr] items-baseline gap-3 border-b border-white/6 px-5 py-3 text-[13.5px] text-bone last:border-b-0 md:grid-cols-[100px_120px_1fr]">
              <span className="font-mono text-[11px] text-ash-2">{t}</span>
              <span className="font-medium text-amber-2">{k}</span>
              <span className="text-bone/85">{d}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[12px] text-ash-2">
        The Outside runs on its own network processor. The Inside has no route to it except the Gate. This is wiring, not a setting.
      </p>
    </div>
  );
}
