"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader, Pill, whereLabel } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { ask, type AskAnswer } from "@/lib/core/ask";
import { actions, describe } from "@/lib/core/actions";
import { explainAction } from "@/lib/core/actions";

type Msg = { id: number; role: "user"; text: string } | { id: number; role: "box"; answer: AskAnswer; decided?: "approved" | "declined" };

const starters = ["What happened today?", "Find the lease", "Turn the kitchen light off", "How is the box?"];

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

      <div className="flex-1 overflow-y-auto rounded-[14px] bg-white p-4 ring-1 ring-ink/5 md:p-6">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="orb" style={{ ["--orb" as string]: "14px" }} />
            <p className="mt-8 max-w-[440px] text-[15px] text-ash">
              This Core answers from its files, photos, devices, backups, routines, memory and receipts, by plain rules. It says when it does not know. A language model on the box comes later.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full bg-bone px-3.5 py-1.5 text-[13px] font-medium hover:bg-chassis">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
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
                    <div className="mt-2 rounded-[12px] border border-amber/50 bg-ask-bg/60 p-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ask">Asks first · {a.action.decision.reason}</div>
                      <div className="mt-1 text-[14px] font-medium">{a.action.preview}</div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => void decide(m.id, a.action!.id, "approved")} className="btn btn-primary min-w-0 h-9 px-4 text-[13px]">
                          Approve once
                        </button>
                        <button type="button" onClick={() => void decide(m.id, a.action!.id, "declined")} className="btn btn-secondary min-w-0 h-9 px-4 text-[13px]">
                          Not now
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-1 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
                    {whereLabel[a.where]} · {a.ms} ms · {a.source}
                    {a.action ? ` · ${a.action.status}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {busy && <div className="pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">looking · inside</div>}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 ring-1 ring-ink/8 focus-within:ring-ink/25">
        <span className="ml-2 orb" style={{ ["--orb" as string]: "9px" }} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the box…" aria-label="Ask the box" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-ash" />
        <button type="submit" aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-bone disabled:opacity-40" disabled={!input.trim() || busy}>
          ↑
        </button>
      </form>
    </div>
  );
}
