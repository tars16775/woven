"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { bytes } from "@/lib/core/files";
import { coreClient } from "@/lib/core/store";
import { useSession } from "@/lib/auth";
import { BackupStatus } from "@woven/schema";

async function call(path: string, init: RequestInit = {}) {
  const c = coreClient();
  if (!c) throw new Error("No Core is connected.");
  const res = await fetch(`${c.base}${path}`, { ...init, credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
  return BackupStatus.parse(await res.json());
}

/** Snapshots, the second location, and the restore drill (phase 23). Owners act; adults look. */
export function BackupsCard() {
  const session = useSession();
  const say = useToast();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canSee = session?.role === "owner" || session?.role === "adult";
  const isOwner = session?.role === "owner";

  useEffect(() => {
    if (!canSee) return;
    let alive = true;
    call("/v1/system/backups")
      .then((s) => alive && setStatus(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canSee]);

  if (!canSee) return null;

  const run = async (what: "snapshot" | "drill") => {
    if (busy) return;
    setBusy(what);
    try {
      const s = await call(`/v1/system/backups/${what}`, { method: "POST" });
      setStatus(s);
      if (what === "drill") say(s.lastDrill?.ok ? `Restore drill passed: ${s.lastDrill.ledger.rows} receipts and ${s.lastDrill.objects.checked} objects came back intact in ${(s.lastDrill.durationMs / 1000).toFixed(1)} s.` : `Restore drill failed: ${s.lastDrill?.problem ?? "unknown"}`);
      else say("Snapshot taken · receipt written");
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(null);
    }
  };

  const latest = status?.snapshots[0];
  return (
    <Card
      title="Backups"
      action={
        isOwner ? (
          <div className="flex gap-2">
            <Button kind="soft" onClick={() => run("snapshot")} disabled={busy !== null} aria-busy={busy === "snapshot"}>
              {busy === "snapshot" ? "Taking…" : "Snapshot now"}
            </Button>
            <Button onClick={() => run("drill")} disabled={busy !== null || !latest} aria-busy={busy === "drill"} data-testid="restore-drill">
              {busy === "drill" ? "Restoring…" : "Run a restore drill"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px] sm:grid-cols-3">
        <div>
          <dt className="text-ash">Latest snapshot</dt>
          <dd className="mt-0.5 font-medium">{latest ? new Date(latest.takenAt).toLocaleString() : "None yet · nightly at 3:00"}</dd>
          {latest && <dd className="text-[12px] text-ash">{latest.objects} objects · {bytes(latest.bytes)}</dd>}
        </div>
        <div>
          <dt className="text-ash">Second location</dt>
          <dd className="mt-0.5 font-medium">{status?.mirror ? <Pill tone={latest?.mirrored ? "good" : "warn"}>{latest?.mirrored ? "Mirrored" : "Not yet copied"}</Pill> : <Pill tone="warn">Not set</Pill>}</dd>
          <dd className="text-[12px] text-ash">{status?.mirror ?? "Set WOVEN_SNAPSHOT_MIRROR to a second drive."}</dd>
        </div>
        <div>
          <dt className="text-ash">Last restore drill</dt>
          <dd className="mt-0.5 font-medium" data-testid="drill-result">
            {status?.lastDrill ? <Pill tone={status.lastDrill.ok ? "good" : "warn"}>{status.lastDrill.ok ? "Restored and verified" : "Failed"}</Pill> : "Not run since the core started"}
          </dd>
          {status?.lastDrill && <dd className="text-[12px] text-ash">{status.lastDrill.ledger.rows} receipts · {status.lastDrill.objects.checked} objects checked · {new Date(status.lastDrill.at).toLocaleTimeString()}</dd>}
        </div>
      </dl>
      <p className="mt-3 text-[12px] text-ash">A drill restores the newest snapshot into a scratch folder, opens it, verifies the chain and the objects, then throws the scratch away. {status?.snapshots.length ?? 0} snapshots kept on the box.</p>
    </Card>
  );
}
