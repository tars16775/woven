"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader, whereLabel } from "@/components/dashboard/ui";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "tandem"; text: string; where: "local" | "cloud"; ms: number; source: string }
  | { id: number; role: "approval"; task: string; sends: string; decided?: "approved" | "kept" };

/**
 * Local answer engine for the demo: matches a few household intents and
 * otherwise proposes a crossing. The backend replaces `answer` with
 * Tandem; the surface stays the same.
 */
function answer(q: string, id: number): Msg[] {
  const t = q.toLowerCase();
  if (/dentist|appointment/.test(t))
    return [{ id, role: "tandem", text: "Thursday at 4:10 pm, from the household calendar. Sam is picking Maya up.", where: "local", ms: 410, source: "Household calendar" }];
  if (/lease|rent/.test(t))
    return [{ id, role: "tandem", text: "Your lease renews on September 16. Last year's rent was $2,150; the renewal letter in Files/Home proposes $2,240. I can draft a reply if you want.", where: "local", ms: 880, source: "Files/Home · 2 documents" }];
  if (/light|lamp/.test(t) && /off|on/.test(t))
    return [{ id, role: "tandem", text: `Done. ${/off/.test(t) ? "Lights off" : "Lights on"} in the living room, read back from the devices. Written to Activity.`, where: "local", ms: 520, source: "Home · 2 devices verified" }];
  if (/photo|picture/.test(t))
    return [{ id, role: "tandem", text: "I found 38 photos from the lake trip in July, indexed on the box. Maya is in 21 of them. Want an album?", where: "local", ms: 640, source: "Photos · local index" }];
  if (/backup|back up/.test(t))
    return [{ id, role: "tandem", text: "Maya's laptop last backed up six days ago. I can back it up tonight over Wi-Fi when it is on the charger, or remind her now.", where: "local", ms: 300, source: "Backup status" }];
  if (/lock|door/.test(t))
    return [{ id, role: "tandem", text: "The front door is locked and the contact sensor reads closed. Unlocking is a class D action and would need your approval on the screen.", where: "local", ms: 350, source: "Home · Entry" }];
  return [
    { id, role: "tandem", text: "That needs more than what is on the box. I can send one task across the Gate with the minimum context, or answer from what I have.", where: "local", ms: 260, source: "Router" },
    { id: id + 1, role: "approval", task: `Deep research: “${q.trim().slice(0, 60)}”`, sends: "the task text · your city · no names, files or history" },
  ];
}

const starters = [
  "When is Maya's dentist appointment?",
  "What does my lease say about renewal?",
  "Turn the living room lights off",
  "Compare heat pumps for this house",
];

export function AskChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    const id = (seq.current += 10);
    const q: Msg = { id, role: "user", text: text.trim() };
    setMsgs((m) => [...m, q]);
    setInput("");
    setBusy(true);
    setTimeout(() => {
      setMsgs((m) => [...m, ...answer(text, id + 1)]);
      setBusy(false);
    }, 500);
  };

  const decide = (id: number, d: "approved" | "kept") =>
    setMsgs((m) =>
      m.map((x) => (x.role === "approval" && x.id === id ? { ...x, decided: d } : x)),
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="mx-auto flex h-[calc(100svh-7.5rem)] max-w-[860px] flex-col">
      <PageHeader title="Ask" sub="Answers from the household, on the box. Crosses the Gate only if you approve it." />

      <div className="flex-1 overflow-y-auto rounded-[14px] bg-white p-4 ring-1 ring-ink/5 md:p-6">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="orb" style={{ ["--orb" as string]: "14px" }} />
            <p className="mt-8 max-w-[400px] text-[15px] text-ash">
              Tandem knows the calendar, files, photos and home. Try one of these, or ask your own.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full bg-bone px-3.5 py-1.5 text-[13px] font-medium hover:bg-chassis"
                >
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
                  <div className="max-w-[78%] rounded-[14px] rounded-br-[4px] bg-ink px-4 py-2.5 text-[14px] text-bone">
                    {m.text}
                  </div>
                </div>
              );
            if (m.role === "tandem")
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="rounded-[14px] rounded-bl-[4px] bg-bone px-4 py-2.5 text-[14px] leading-relaxed">
                      {m.text}
                    </div>
                    <div className="mt-1 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
                      {whereLabel[m.where]} · {m.ms} ms · {m.source}
                    </div>
                  </div>
                </div>
              );
            return (
              <div key={m.id} className="max-w-[85%] rounded-[14px] border border-amber/50 bg-ask-bg/60 p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ask">Crossing · asks first</div>
                <div className="mt-1.5 text-[14px] font-medium">{m.task}</div>
                <div className="mt-1 text-[13px] text-ash">Sends {m.sends}</div>
                {!m.decided ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => decide(m.id, "approved")} className="btn btn-primary min-w-0 h-9 px-4 text-[13px]">
                      Approve once
                    </button>
                    <button type="button" onClick={() => decide(m.id, "kept")} className="btn btn-secondary min-w-0 h-9 px-4 text-[13px]">
                      Keep it inside
                    </button>
                  </div>
                ) : m.decided === "approved" ? (
                  <div className="mt-3 text-[13px]">Sent and logged in Activity with your name. The answer will appear here.</div>
                ) : (
                  <div className="mt-3 text-[13px]">Kept inside. Tandem will answer from what the box knows and say where it is unsure.</div>
                )}
              </div>
            );
          })}
          {busy && (
            <div className="pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">thinking · inside</div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 ring-1 ring-ink/8 focus-within:ring-ink/25">
        <span className="ml-2 orb" style={{ ["--orb" as string]: "9px" }} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Tandem anything…"
          aria-label="Ask Tandem"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-ash"
        />
        <button type="submit" aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-bone disabled:opacity-40" disabled={!input.trim() || busy}>
          ↑
        </button>
      </form>
    </div>
  );
}
