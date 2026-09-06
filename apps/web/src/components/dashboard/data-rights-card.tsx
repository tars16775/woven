"use client";

import { useState } from "react";
import { Button, Card } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explain, identity } from "@/lib/core/identity";
import { signOut, useSession } from "@/lib/auth";
import { useRouter } from "next/navigation";

/** Export everything as a folder on the box; delete your own account. Phase 11. */
export function DataRightsCard() {
  const session = useSession();
  const say = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const isOwner = session?.role === "owner";

  const exportData = async (scope: "me" | "household") => {
    if (busy) return;
    setBusy(scope);
    try {
      const r = await identity.exportData(scope);
      say(`Exported ${r.counts.files ?? 0} files and ${r.counts.receipts ?? 0} receipts to ${r.dir}`);
    } catch (err) {
      say(explain(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteMe = async () => {
    if (!session?.personId) return;
    setBusy("delete");
    try {
      await identity.deleteAccount(session.personId);
      signOut();
      router.replace("/login");
    } catch (err) {
      say(explain(err));
      setBusy(null);
    }
  };

  return (
    <Card title="Your data">
      <ul className="divide-y divide-ink/6 text-[14px]">
        <li className="flex items-center justify-between gap-4 py-2.5 pt-0">
          <div>
            <div className="font-medium">Export everything you own</div>
            <div className="text-[12px] text-ash">A folder on the box: your files, receipts and record, as plain JSON and the original objects.</div>
          </div>
          <Button kind="soft" onClick={() => exportData("me")} disabled={busy !== null} aria-busy={busy === "me"} data-testid="export-me">
            {busy === "me" ? "Exporting…" : "Export"}
          </Button>
        </li>
        {isOwner && (
          <li className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <div className="font-medium">Export the whole household</div>
              <div className="text-[12px] text-ash">Everyone&apos;s data, for a move to another box or a backup you hold yourself.</div>
            </div>
            <Button kind="soft" onClick={() => exportData("household")} disabled={busy !== null} aria-busy={busy === "household"}>
              {busy === "household" ? "Exporting…" : "Export all"}
            </Button>
          </li>
        )}
        <li className="flex items-center justify-between gap-4 py-2.5 pb-0">
          <div>
            <div className="font-medium">Delete your account</div>
            <div className="text-[12px] text-ash">{isOwner ? "Owners transfer ownership first." : "Removes your files, keys and sessions from the box. The ledger keeps that it happened."}</div>
          </div>
          <Button kind="quiet" onClick={() => setConfirm(true)} disabled={isOwner || busy !== null}>
            Delete
          </Button>
        </li>
      </ul>
      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="Cannot be undone" title="Delete your account?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">Export first if you want to keep anything. After this, nothing of yours remains on the box except the ledger&apos;s record that the account was deleted.</p>
        <DialogActions>
          <Button kind="danger" className="flex-1 py-2.5" onClick={deleteMe} disabled={busy !== null}>
            Delete everything of mine
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirm(false)} data-autofocus>
            Keep my account
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
