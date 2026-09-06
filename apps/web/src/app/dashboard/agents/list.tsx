"use client";

import { useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { agents as initial, catalogue, type Agent } from "@/lib/dashboard/data";

export function AgentsList() {
  const say = useToast();
  const [agents, setAgents] = useState<Agent[]>(initial);
  const [revoking, setRevoking] = useState<Agent | null>(null);
  const [installing, setInstalling] = useState(false);

  const togglePause = (id: string) =>
    setAgents((as) => as.map((a) => (a.id === id ? { ...a, state: a.state === "active" ? "paused" : "active" } : a)));

  const revoke = () => {
    if (!revoking) return;
    setAgents((as) => as.filter((a) => a.id !== revoking.id));
    say(`${revoking.name} revoked. Its receipts stay in Activity.`);
    setRevoking(null);
  };

  const install = (a: Agent) => {
    setAgents((as) => (as.some((x) => x.id === a.id) ? as : [...as, { ...a, state: "paused", lastAction: "Installed just now, paused" }]));
    setInstalling(false);
    say(`${a.name} installed and paused. Review its scopes, then resume it.`);
  };

  const active = agents.filter((a) => a.state === "active").length;
  const available = catalogue.filter((c) => !agents.some((a) => a.id === c.id));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Agents"
        sub={`${active} active · every action passes the permission engine and leaves a receipt`}
        action={
          <div className="flex items-center gap-2">
            <Pill tone="warn">
              <span data-testid="agents-preview">Preview · no agent runtime yet</span>
            </Pill>
            <Button kind="primary" className="px-5 py-2" onClick={() => setInstalling(true)}>
              Install an agent
            </Button>
          </div>
        }
      />

      <div className="grid gap-4">
        {agents.map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`block h-[8px] w-[8px] rounded-full ${a.state === "active" ? "bg-amber" : "bg-ink/25"}`} />
                  <span className="font-display text-[20px] font-medium tracking-[-0.01em]">{a.name}</span>
                  <span className="text-[14px] text-ash">{a.role}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.scopes.map((s) => (
                    <Pill key={s}>{s}</Pill>
                  ))}
                </div>
                {a.limits && <div className="mt-2 text-[13px] text-ash">Limits: {a.limits}</div>}
                <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                  {a.runtime} · {a.actions7d} actions in 7 days · {a.lastAction}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pill tone={a.state === "active" ? "good" : "neutral"}>{a.state}</Pill>
                {a.id !== "tandem" && (
                  <>
                    <Button kind="soft" onClick={() => togglePause(a.id)}>
                      {a.state === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button kind="quiet" onClick={() => setRevoking(a)} aria-label={`Revoke ${a.name}`}>
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="How agents run here" className="mt-6">
        <ul className="grid gap-3 text-[14px] md:grid-cols-2">
          {[
            "Each agent runs in its own sandbox with its own identity. None runs as you.",
            "Credentials are short-lived and scoped to exactly the capabilities you granted.",
            "Agents cannot reach voice, cameras or another agent's memory.",
            "Revoking an agent invalidates its credentials immediately and keeps its receipts.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={revoking !== null} onClose={() => setRevoking(null)} kicker="Class H · strong auth" title={`Revoke ${revoking?.name ?? ""}?`} tone="ask">
        <p className="mt-2 text-[14px] text-ash">Its credentials stop working now. Its receipts stay in Activity. You can install it again later with fresh scopes.</p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={revoke} data-autofocus>
            Revoke
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setRevoking(null)}>
            Keep
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={installing} onClose={() => setInstalling(false)} kicker="Signed by Woven · runs inside" title="Install an agent" size="md">
        <p className="mt-2 text-[14px] text-ash">New agents arrive paused with their scopes listed. Nothing runs until you resume it.</p>
        {available.length > 0 ? (
          <ul className="mt-4 divide-y divide-ink/6">
            {available.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{a.name}</div>
                  <div className="mt-0.5 text-[13px] text-ash">{a.role}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.scopes.map((s) => (
                      <Pill key={s}>{s}</Pill>
                    ))}
                  </div>
                  {a.limits && <div className="mt-1.5 text-[12px] text-ash">Limits: {a.limits}</div>}
                </div>
                <Button onClick={() => install(a)} aria-label={`Install ${a.name}`}>
                  Install
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-ash">Everything available is installed.</p>
        )}
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setInstalling(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
