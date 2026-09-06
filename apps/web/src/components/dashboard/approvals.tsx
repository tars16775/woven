"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { actions, describe, explainAction, type ActionRecord } from "@/lib/core/actions";
import { useCore } from "@/lib/core/store";
import { useSession } from "@/lib/auth";

const classKicker: Record<string, string> = { C: "Class C · outside the usual bounds", D: "Class D · asks first", E: "Class E · above the limit", H: "Class H · strong authentication" };

/**
 * Approval cards (phase 14): everything waiting for a yes, from anyone in
 * the house. Refreshes whenever the ledger streams a new prepared action.
 */
export function Approvals({ compact = false }: { compact?: boolean }) {
  const core = useCore();
  const session = useSession();
  const say = useToast();
  const [pending, setPending] = useState<ActionRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const live = core.phase === "connected" && session && !session.simulated;
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
    <Card title="Waiting for a yes" className={compact ? "" : "mb-4"} action={<Pill tone="warn">{pending.length}</Pill>}>
      <ul className="divide-y divide-ink/6" data-testid="approvals">
        {pending.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">{classKicker[a.riskClass] ?? `Class ${a.riskClass}`}</div>
              <div className="mt-0.5 text-[15px] font-medium">{a.preview}</div>
              <div className="mt-0.5 text-[13px] text-ash">
                {a.decision.reason}
                {a.approval?.factors.includes("presence") ? " · needs someone home" : ""}
                {a.approval?.factors.includes("strong_auth") ? " · confirm with your passkey" : ""}
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
    </Card>
  );
}
