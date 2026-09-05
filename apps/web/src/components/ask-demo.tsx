"use client";

import { useEffect, useState } from "react";

type Line =
  | { kind: "user"; text: string }
  | { kind: "tandem"; text: string; where: "inside" | "crossing"; ms: number }
  | { kind: "approval"; task: string; sends: string };

const script: Line[] = [
  { kind: "user", text: "When is Maya's dentist appointment?" },
  {
    kind: "tandem",
    text: "Thursday at 4:10 pm, from the household calendar. Sam is picking her up.",
    where: "inside",
    ms: 420,
  },
  { kind: "user", text: "Compare heat pumps for a 1,900 sq ft house in Tampa." },
  {
    kind: "approval",
    task: "Deep research: compare heat pumps",
    sends: "1 task · house size and city · no names, files or history",
  },
];

/**
 * A scripted conversation that shows the two things Tandem does that a
 * cloud assistant cannot: answer from household context without leaving the
 * box, and ask before anything crosses the Gate. The visitor gives the approval.
 */
export function AskDemo() {
  const [step, setStep] = useState(0);
  const [decision, setDecision] = useState<"approved" | "kept" | null>(null);

  useEffect(() => {
    if (step >= script.length) return;
    const delay = script[step].kind === "user" ? 700 : 1100;
    const id = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [step]);

  const shown = script.slice(0, step);

  return (
    <div className="min-h-[400px] w-full max-w-[560px] rounded-[18px] bg-graphite-2 p-5 text-bone shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10 md:p-6">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ash-2">
        <span>Ask</span>
        <span className="flex items-center gap-2">
          <span className="orb" style={{ ["--orb" as string]: "7px" }} />
          Inside
        </span>
      </div>

      <div className="mt-5 space-y-3" aria-live="polite">
        {shown.map((l, i) => {
          if (l.kind === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-bone px-4 py-2.5 text-[14px] text-ink">
                  {l.text}
                </div>
              </div>
            );
          }
          if (l.kind === "tandem") {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="rounded-[14px] rounded-bl-[4px] bg-white/6 px-4 py-2.5 text-[14px] leading-relaxed">
                    {l.text}
                  </div>
                  <div className="mt-1 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">
                    {l.where} · {l.ms} ms · household calendar
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="rounded-[14px] border border-amber/40 bg-amber/8 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-2">
                Cross the Gate? · asks first
              </div>
              <div className="mt-1.5 text-[14px] font-medium">{l.task}</div>
              <div className="mt-1 text-[13px] text-ash-2">Sends {l.sends}</div>
              {decision === null ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision("approved")}
                    className="btn btn-primary min-w-0 h-9 flex-1 px-4 text-[13px]"
                  >
                    Approve once
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision("kept")}
                    className="btn btn-secondary min-w-0 h-9 flex-1 px-4 text-[13px]"
                  >
                    Keep it inside
                  </button>
                </div>
              ) : decision === "approved" ? (
                <div className="mt-3 text-[13px] text-bone/90">
                  Sent. Logged on the screen as{" "}
                  <span className="font-mono">09:30 · Crossing · approved by you</span>.
                </div>
              ) : (
                <div className="mt-3 text-[13px] text-bone/90">
                  Kept inside. Tandem answers from what the box already knows and says where
                  it is unsure.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {step < script.length && (
        <div className="mt-3 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">
          …
        </div>
      )}
    </div>
  );
}
