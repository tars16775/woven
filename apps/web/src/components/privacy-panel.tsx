"use client";

import { useMemo, useState } from "react";

type Rule = "inside" | "ask" | "off";

const categories: { id: string; label: string; fixed?: true; initial: Rule }[] = [
  { id: "voice", label: "Voice & conversations", fixed: true, initial: "inside" },
  { id: "home", label: "Home control & automations", fixed: true, initial: "inside" },
  { id: "cameras", label: "Cameras & clips", fixed: true, initial: "inside" },
  { id: "files", label: "Files, photos, memory", fixed: true, initial: "inside" },
  { id: "research", label: "Deep research & big jobs", initial: "ask" },
  { id: "video", label: "Video generation", initial: "ask" },
];

const ruleLabel: Record<Rule, string> = {
  inside: "Inside",
  ask: "Ask me first",
  off: "Off",
};

/**
 * The Privacy tab from the app, made interactive. Four categories are pinned
 * to Inside on purpose; the visitor can move the other two and watch the
 * week's inside share respond.
 */
export function PrivacyPanel() {
  const [rules, setRules] = useState<Record<string, Rule>>(
    Object.fromEntries(categories.map((c) => [c.id, c.initial])),
  );
  const [paused, setPaused] = useState(false);

  const share = useMemo(() => {
    if (paused) return 100;
    let crossings = 0;
    if (rules.research === "ask") crossings += 3;
    if (rules.video === "ask") crossings += 1;
    // A representative week of 1,000 requests.
    return Math.round(((1000 - crossings) / 1000) * 1000) / 10;
  }, [rules, paused]);

  const crossings = paused ? 0 : (rules.research === "ask" ? 3 : 0) + (rules.video === "ask" ? 1 : 0);

  const cycle = (id: string) =>
    setRules((r) => ({ ...r, [id]: r[id] === "ask" ? "off" : "ask" }));

  return (
    <div className="w-full max-w-[520px] rounded-[18px] bg-white p-5 text-ink shadow-[0_40px_80px_-40px_rgba(20,20,20,0.35)] ring-1 ring-ink/5 md:p-6">
      <div className="rounded-[14px] bg-bone px-5 py-5">
        <div className="text-[13px] text-ash">This week</div>
        <div className="mt-1 font-display text-[38px] font-medium leading-none tracking-[-0.02em]">
          {share}% inside
        </div>
        <div className="mt-1.5 text-[13px] text-ash">
          {crossings === 0 ? "No crossings" : `${crossings} crossings · all approved by you`}
        </div>
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-chassis">
          <div
            className="h-full rounded-full bg-amber transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${share}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {categories.map((c) => {
          const rule = paused && !c.fixed ? "off" : rules[c.id];
          const pill =
            rule === "inside"
              ? "bg-local-bg text-local"
              : rule === "ask"
                ? "bg-ask-bg text-ask"
                : "bg-chassis text-ash";
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 rounded-[12px] border border-ink/8 px-4 py-3"
            >
              <span className="text-[14px] font-medium">{c.label}</span>
              {c.fixed ? (
                <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${pill}`}>
                  {ruleLabel[rule]}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => cycle(c.id)}
                  disabled={paused}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors disabled:opacity-60 ${pill}`}
                  aria-label={`${c.label}: ${ruleLabel[rule]}. Change`}
                >
                  {ruleLabel[rule]}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="mt-4 flex w-full items-center justify-between rounded-[12px] bg-graphite px-4 py-3.5 text-left text-bone"
      >
        <span className="text-[14px] font-medium">Close the Gate</span>
        <span
          className={`relative block h-6 w-11 rounded-full transition-colors ${
            paused ? "bg-amber" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white transition-transform ${
              paused ? "translate-x-[23px]" : "translate-x-[3px]"
            }`}
          />
        </span>
      </button>

      <p className="mt-3 text-[12px] leading-relaxed text-ash">
        Every crossing is recorded with what was sent and why. Voice, home and camera data
        never cross the Gate. The four pinned categories cannot be changed, even by you.
      </p>
    </div>
  );
}
