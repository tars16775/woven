"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrivacyPanel } from "@/components/privacy-panel";
import { Button, Card, PageHeader, WherePill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { signOut, useSession } from "@/lib/auth";
import { useCore } from "@/lib/core/store";
import { MemoryCard } from "@/components/dashboard/memory-card";
import { activity, core, memories as initialMemories, privacyCategories } from "@/lib/dashboard/data";

type Open = null | "export" | "memory" | "delete-1" | "delete-2";

const exportContents = [
  ["Files and photos", "Originals, as stored · 1.2 TB"],
  ["Memory", "What Tandem remembers about each person · JSON, readable"],
  ["Receipts", "Every action in Activity since day one"],
  ["Home", "Devices, pairings, routines and permissions"],
];

export function PrivacyView() {
  const router = useRouter();
  const say = useToast();
  const [open, setOpen] = useState<Open>(null);
  const [memories, setMemories] = useState(initialMemories);
  const crossings = activity.filter((a) => a.where === "cloud");
  const connection = useCore();
  const session = useSession();
  const live = connection.phase === "connected" && !!session && !session.simulated;

  const close = () => setOpen(null);

  const startExport = () => {
    close();
    say("Export started on the box. Tandem will tell you when the drive is ready.");
  };

  const forget = (id: string) => {
    setMemories((m) => m.filter((x) => x.id !== id));
    say("Memory deleted. Gone from backups within 24 hours.");
  };

  const deleteAccount = () => {
    close();
    signOut();
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Privacy" sub={`${core.insideShare7d}% inside this week · ${core.crossings7d} crossings, all approved by you`} />
      {live && (
        <div className="mb-4">
          <MemoryCard />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <PrivacyPanel />
        <div className="grid gap-4">
          <Card title="Events by category, 7 days">
            <ul className="divide-y divide-ink/6">
              {privacyCategories.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <span className="font-medium">{c.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-ash">{c.events7d}</span>
                    <WherePill where={c.rule === "local" ? "local" : "cloud"} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Crossings">
            <ul className="divide-y divide-ink/6">
              {crossings.map((b) => (
                <li key={b.id} className="py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{b.detail.split(" · ")[0]}</span>
                    <span className="font-mono text-[11px] text-ash">
                      {b.day === "today" ? "" : "Yesterday "}
                      {b.time}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ash">
                    Sent: {b.sent} · approved by {b.actor}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Your data">
            <div className="flex flex-wrap gap-2">
              <Button kind="soft" onClick={() => setOpen("export")}>
                Export everything
              </Button>
              <Button kind="soft" onClick={() => setOpen("memory")}>
                Delete a memory
              </Button>
              <Button kind="soft" onClick={() => setOpen("delete-1")}>
                Delete my account
              </Button>
            </div>
            <p className="mt-3 text-[12px] text-ash">Exports are produced on the box. Deletions propagate to backups within the documented window.</p>
          </Card>
        </div>
      </div>

      <Dialog open={open === "export"} onClose={close} kicker="Produced inside · encrypted with your key" title="Export everything" size="md">
        <ul className="mt-4 divide-y divide-ink/6">
          {exportContents.map(([k, v]) => (
            <li key={k} className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
              <span className="font-medium">{k}</span>
              <span className="text-right text-[13px] text-ash">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-ash">Plug a drive into the box or let it write to Files/Exports. About 90 minutes for this household. Nothing crosses the Gate.</p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={startExport} data-autofocus>
            Start export
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "memory"} onClose={close} kicker={`Tandem remembers ${memories.length} ${memories.length === 1 ? "thing" : "things"} about you`} title="Delete a memory" size="md">
        {memories.length > 0 ? (
          <ul className="mt-4 divide-y divide-ink/6">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 py-3 text-[14px]">
                <div>
                  <div className="font-medium">{m.text}</div>
                  <div className="mt-0.5 text-[12px] text-ash">{m.learned}</div>
                </div>
                <Button kind="quiet" onClick={() => forget(m.id)} aria-label={`Delete memory: ${m.text}`}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-ash">Nothing left. Tandem starts again from what you tell it.</p>
        )}
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "delete-1"} onClose={close} kicker="Class H · strong auth" title="Delete your account?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          Your files, photos, memory and receipts are erased from the box and from backups within 30 days. The household keeps running for everyone else. This cannot be undone.
        </p>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Keep my account
          </Button>
          <Button kind="danger" className="flex-1 py-2.5" onClick={() => setOpen("delete-2")}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "delete-2"} onClose={close} kicker="Last step" title="Delete everything about you" tone="ask">
        <p className="mt-2 text-[14px] text-ash">You will be signed out now and the box begins erasing. Anyone else in the household is unaffected.</p>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button kind="danger" className="flex-1 py-2.5" onClick={deleteAccount}>
            Delete my account
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
