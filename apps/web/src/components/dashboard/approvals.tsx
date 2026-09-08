"use client";

import { useEffect, useState } from "react";
import { Button, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { actions, describe, explainAction, type ActionRecord } from "@/lib/core/actions";
import { useCore } from "@/lib/core/store";
import { useSession } from "@/lib/auth";

const classKicker: Record<string, string> = { C: "Class C · outside the usual bounds", D: "Class D · asks first", E: "Class E · above the limit", H: "Class H · strong authentication" };

/**
 * Everything waiting for a yes, from anyone in the house (gap 14).
 * Refreshes whenever the ledger streams a new prepared action.
 *
 * Design phase 24: an approval is the one thing on the dashboard that is
 * addressed to a person rather than merely shown to them, so it is the one
 * card that gets the amber ground. Its two buttons are the only pair in the
 * product where the destructive-looking choice — declining — is the safe one,
 * which is why neither is red: the risk lives in the action, not the answer.
 */
export function Approvals({ compact = false }: { compact?: boolean }) {
  const core = useCore();
  const session = useSession();
  const say = useToast();
  const [pending, setPending] = useState<ActionRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const live = core.phase === "connected" && !!session;
  const head = core.phase === "connected" ? (core.rows[0]?.seq ?? 0) : 0;

  useEffect(() => {
    if (!live) return;
    let alive = true;
    actions
      .pending()
      .then((list) => alive && setPending(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [live, head]);

  if (!live || pending.length === 0) return null;

  const decide = async (a: ActionRecord, yes: boolean) => {
    if (busy) return;
    setBusy(a.id);
    try {
      let result = yes ? await actions.approve(a.id) : await actions.decline(a.id);
      if (yes && result.status === "approved") result = await actions.execute(a.id);
      setPending((p) => p.filter((x) => x.id !== a.id));
      say(describe(result));
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      className={`rounded-[14px] bg-ask-bg p-5 shadow-[var(--shadow-card)] ring-1 ring-amber/30 ${compact ? "" : "mb-4"}`}
      aria-labelledby="approvals-title"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="approvals-title" className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ask">
          Waiting for you
        </h2>
        <Pill tone="warn">{pending.length}</Pill>
      </div>
      <ul className="mt-3 divide-y divide-amber/20" data-testid="approvals">
        {pending.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">{classKicker[a.riskClass] ?? `Class ${a.riskClass}`}</div>
              <div className="mt-0.5 text-[15px] font-medium">{a.preview}</div>
              <div className="mt-0.5 text-[13px] leading-relaxed text-ash">
                {a.decision.reason}
                {a.approval?.factors.includes("presence") ? " · needs someone home" : ""}
                {a.approval?.factors.includes("strong_auth") ? " · confirm with your passkey" : ""}
              </div>
              <div className="tnum mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
                asked {new Date(a.createdAt).toLocaleString([], { hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button kind="primary" onClick={() => decide(a, true)} disabled={busy !== null} aria-busy={busy === a.id}>
                Approve
              </Button>
              <Button kind="soft" onClick={() => decide(a, false)} disabled={busy !== null}>
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * How many decisions are waiting, for the shell's indicator. Separate from
 * the card because it has to work from every room, including the ones that
 * do not show approvals at all — an approval a person cannot see from where
 * they are standing is one that waits until they happen to visit Overview.
 */
export function usePendingCount(): number {
  const core = useCore();
  const session = useSession();
  const [n, setN] = useState(0);
  const live = core.phase === "connected" && !!session;
  const head = core.phase === "connected" ? (core.rows[0]?.seq ?? 0) : 0;

  useEffect(() => {
    if (!live) return;
    let alive = true;
    actions
      .pending()
      .then((list) => alive && setN(list.length))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [live, head]);

  // Disconnected means nothing is known, not that nothing is waiting; report
  // zero without writing it, so the count is derived rather than remembered.
  return live ? n : 0;
}
