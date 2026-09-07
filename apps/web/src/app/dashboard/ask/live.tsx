"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, PageHeader, Pill, whereLabel } from "@/components/dashboard/ui";
import { IconChevron } from "@/components/dashboard/icons";
import { useToast } from "@/components/dashboard/toast";
import { ask, type AskAnswer } from "@/lib/core/ask";
import { actions, describe } from "@/lib/core/actions";
import { explainAction } from "@/lib/core/actions";
import { RoomNote } from "@/components/dashboard/room-note";

type Msg = { id: number; role: "user"; text: string } | { id: number; role: "box"; answer: AskAnswer; decided?: "approved" | "declined" };

/* Questions the rules can actually answer today. A starter that returns "I do
   not know" teaches the wrong lesson on the first try. */
const starters = ["What happened today?", "How is the box?", "What crossed the Gate?", "What is backed up?"];

/**
 * Ask against the household's own Core (gap 11). Every answer comes from
 * rules over what is on the box and says so; nothing crosses the Gate for
 * a question. An answer that changed the house carries the action record,
 * and one that needs approval offers it here.
 */
export function LiveAskChat() {
  const say = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const id = (seq.current += 2);
    setMsgs((m) => [...m, { id, role: "user", text: text.trim() }]);
    setInput("");
    setBusy(true);
    try {
      const answer = await ask.question(text.trim());
      setMsgs((m) => [...m, { id: id + 1, role: "box", answer }]);
    } catch (err) {
      setMsgs((m) => [...m, { id: id + 1, role: "box", answer: { text: explainAction(err), source: "Core", where: "local", ms: 0, engine: "rules", action: null, items: [] } }]);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (msgId: number, actionId: string, d: "approved" | "declined") => {
    try {
      const r = d === "approved" ? await actions.approve(actionId) : await actions.decline(actionId);
      const done = d === "approved" && r.status === "approved" ? await actions.execute(actionId) : r;
      setMsgs((m) => m.map((x) => (x.role === "box" && x.id === msgId ? { ...x, decided: d, answer: { ...x.answer, action: done } } : x)));
      say(describe(done));
    } catch (err) {
      say(explainAction(err));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="mx-auto flex h-[calc(100svh-7.5rem)] max-w-[860px] flex-col">
      <PageHeader
        title="Ask"
        sub="Answers from what is on the box. Nothing crosses the Gate for a question."
        action={
          <Pill tone="neutral">
            <span data-testid="ask-engine">Rules on the box · no model yet</span>
          </Pill>
        }
      />

      <RoomNote id="room:ask" />

      <div className="flex-1 overflow-y-auto rounded-[14px] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/5 md:p-6">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="orb" style={{ ["--orb" as string]: "14px" }} />
            <p className="mt-8 max-w-[440px] text-[15px] text-ash">
              This Core answers from its files, photos, devices, backups, routines, memory and receipts, by plain rules. It says when it does not know. A language model on the box comes later.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="tap rounded-full bg-bone px-3.5 py-1.5 text-[13px] font-medium hover:bg-chassis">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4" role="log" aria-live="polite" aria-label="Answers">
          {msgs.map((m) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[78%] rounded-[14px] rounded-br-[4px] bg-ink px-4 py-2.5 text-[14px] text-bone">{m.text}</div>
                </div>
              );
            const a = m.answer;
            const pending = a.action && a.action.status === "prepared" && !m.decided;
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="rounded-[14px] rounded-bl-[4px] bg-bone px-4 py-2.5 text-[14px] leading-relaxed" data-testid="ask-answer">
                    {a.text}
                    {a.items.length > 0 && (
                      <ul className="mt-2 divide-y divide-ink/6 border-t border-ink/6 pt-1">
                        {a.items.map((it, i) => (
                          <li key={`${it.title}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                            {it.href ? (
                              <Link href={it.href} className="font-medium underline-offset-2 hover:underline">
                                {it.title}
                              </Link>
                            ) : (
                              <span className="font-medium">{it.title}</span>
                            )}
                            <span className="text-right text-ash">{it.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {pending && a.action && (
                    <div className="mt-2 rounded-[12px] bg-ask-bg p-3.5 ring-1 ring-amber/30">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ask">Asks first · {a.action.decision.reason}</div>
                      <div className="mt-1.5 text-[14px] font-medium">{a.action.preview}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button kind="primary" className="px-4 py-2" onClick={() => void decide(m.id, a.action!.id, "approved")}>
                          Approve once
                        </Button>
                        <Button kind="soft" className="px-4 py-2" onClick={() => void decide(m.id, a.action!.id, "declined")}>
                          Not now
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Where it ran, how long it took, and what it read. Every
                      answer carries this, so none of them has to be trusted. */}
                  <div className="tnum mt-1 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
                    {whereLabel[a.where]} · {a.ms} ms · {a.source}
                    {a.action ? ` · ${a.action.status}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-2 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash" role="status">
              <span className="orb" style={{ ["--orb" as string]: "7px" }} />
              looking · inside
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="tap mt-3 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 shadow-[var(--shadow-card)] ring-1 ring-ink/8 focus-within:ring-ink/25">
        <span className="ml-2 orb" style={{ ["--orb" as string]: "9px" }} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the box…"
          aria-label="Ask the box"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-ash"
        />
        <button
          type="submit"
          aria-label="Send"
          className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-bone disabled:opacity-40"
          disabled={!input.trim() || busy}
        >
          <IconChevron dir="up" size={16} />
        </button>
      </form>
      <p className="mt-2 px-3 text-[12px] text-ash">
        Questions are answered from the box&apos;s own data. If one needs something outside, it will say so and offer a single crossing at the Gate.
      </p>
    </div>
  );
}
