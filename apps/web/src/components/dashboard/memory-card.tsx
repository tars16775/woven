"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explain, identity, type Memory, type MemorySettings } from "@/lib/core/identity";

/**
 * What Tandem may keep about you (phase 36): yours to read, edit, confirm,
 * forget, and to say how long anything is kept. Nobody else in the house
 * sees this list, the owner included.
 */
export function MemoryCard() {
  const say = useToast();
  const [items, setItems] = useState<Memory[]>([]);
  const [settings, setSettings] = useState<MemorySettings>({ retentionDays: 365, candidateDays: 7 });
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const refresh = async () => {
    try {
      const r = await identity.memories();
      setItems(r.memories);
      setSettings(r.settings);
    } catch (err) {
      say(explain(err));
    }
  };
  useEffect(() => {
    let alive = true;
    identity
      .memories()
      .then((r) => {
        if (!alive) return;
        setItems(r.memories);
        setSettings(r.settings);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      await refresh();
      if (done) say(done);
    } catch (err) {
      say(explain(err));
    }
  };

  const candidates = items.filter((m) => m.status === "candidate");
  const durable = items.filter((m) => m.status === "durable");
  const retention = settings.retentionDays === null ? "forever" : String(settings.retentionDays);

  return (
    <Card
      title="What Tandem remembers about you"
      action={
        <div className="flex gap-2">
          <Button kind="soft" onClick={() => setAdding(true)} data-testid="add-memory">
            Tell it something
          </Button>
          {items.length > 0 && (
            <Button kind="quiet" onClick={() => setConfirmAll(true)}>
              Forget everything
            </Button>
          )}
        </div>
      }
    >
      {candidates.length > 0 && (
        <div className="mb-3 rounded-[10px] bg-ask-bg p-3 ring-1 ring-ask/20" data-testid="candidates">
          <div className="text-[13px] font-medium">Noticed, not kept yet</div>
          <p className="text-[12px] text-ash">A passing remark is not a memory. Keep what is true; the rest is forgotten in {settings.candidateDays} days.</p>
          <ul className="mt-2 divide-y divide-ink/6">
            {candidates.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                <span>{m.text}</span>
                <span className="flex shrink-0 gap-1">
                  <Button kind="soft" className="py-1" onClick={() => act(() => identity.confirmMemory(m.id), "Kept.")}>
                    Keep
                  </Button>
                  <Button kind="quiet" className="py-1" onClick={() => act(() => identity.forgetMemory(m.id))}>
                    Forget
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {durable.length === 0 ? (
        <p className="text-[14px] text-ash" data-testid="no-memory">
          Nothing yet. Tandem starts from what you tell it.
        </p>
      ) : (
        <ul className="divide-y divide-ink/6" data-testid="memories">
          {durable.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3 text-[14px] first:pt-0 last:pb-0">
              <div>
                <div className="font-medium">{m.text}</div>
                <div className="mt-0.5 text-[12px] text-ash">
                  {m.source === "person" ? "You said so" : `Noticed ${m.seen} times`} · {new Date(m.createdAt).toLocaleDateString()}
                  {m.expiresAt ? ` · forgotten ${new Date(m.expiresAt).toLocaleDateString()}` : " · kept until you delete it"}
                </div>
              </div>
              <span className="flex shrink-0 gap-1">
                <Button kind="quiet" className="py-1" onClick={() => { setEditing(m); setDraft(m.text); }}>
                  Edit
                </Button>
                <Button kind="quiet" className="py-1" onClick={() => act(() => identity.forgetMemory(m.id), "Forgotten. Gone from the next snapshot too.")} aria-label={`Forget: ${m.text}`}>
                  Forget
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/6 pt-4 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-ash">Keep memories for</span>
          <select
            className={`${inputClass} w-auto py-1`}
            value={retention}
            onChange={(e) => act(() => identity.memorySettings({ ...settings, retentionDays: e.target.value === "forever" ? null : Number(e.target.value) }), "Retention changed for everything, old and new.")}
            aria-label="Retention"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">a year</option>
            <option value="forever">until I delete them</option>
          </select>
        </div>
        <Pill>{durable.length} kept · {candidates.length} noticed</Pill>
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} kicker="Memory" title="Tell Tandem something to keep">
        <Field label="In your words">
          <input className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="I take my coffee black" data-autofocus />
        </Field>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" disabled={!draft.trim()} onClick={() => act(() => identity.remember(draft.trim()), "Kept.").then(() => { setAdding(false); setDraft(""); })}>
            Keep it
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} kicker="Memory" title="Edit">
        <input className={`${inputClass} mt-4`} value={draft} onChange={(e) => setDraft(e.target.value)} data-autofocus />
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" disabled={!draft.trim()} onClick={() => act(() => identity.editMemory(editing!.id, draft.trim())).then(() => setEditing(null))}>
            Save
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmAll} onClose={() => setConfirmAll(false)} kicker="Cannot be undone" title="Forget everything?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">Every memory about you goes, kept and noticed alike. Tandem starts again from what you tell it.</p>
        <DialogActions>
          <Button kind="danger" className="flex-1 py-2.5" onClick={() => act(() => identity.forgetAllMemories(), "Forgotten.").then(() => setConfirmAll(false))}>
            Forget everything
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirmAll(false)} data-autofocus>
            Keep them
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
