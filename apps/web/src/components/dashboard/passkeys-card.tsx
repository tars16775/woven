"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { deviceLabel, explain, identity, type Passkey } from "@/lib/core/identity";
import { useCore } from "@/lib/core/store";
import { useSession } from "@/lib/auth";

/**
 * The signed-in person's keys to the house: passkeys on their devices,
 * recovery codes, and the other devices currently signed in. Only shown
 * when a Core issued the session.
 */
export function PasskeysCard() {
  const core = useCore();
  const session = useSession();
  const say = useToast();
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [codesLeft, setCodesLeft] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = core.phase === "connected" && session && !session.simulated;

  const refresh = async () => {
    try {
      const r = await identity.passkeys();
      setKeys(r.passkeys);
      setCodesLeft(r.recoveryCodesLeft);
    } catch (err) {
      setError(explain(err));
    }
  };

  useEffect(() => {
    if (!live) return;
    let alive = true;
    identity
      .passkeys()
      .then((r) => {
        if (!alive) return;
        setKeys(r.passkeys);
        setCodesLeft(r.recoveryCodesLeft);
      })
      .catch((err: unknown) => alive && setError(explain(err)));
    return () => {
      alive = false;
    };
  }, [live]);

  if (!live) return null;

  const run = async (what: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(null);
    }
  };

  const add = () =>
    run("add", async () => {
      await identity.registerPasskey({ label: deviceLabel() });
      await refresh();
      say("This device now has a passkey for the house.");
    });
  const remove = (k: Passkey) =>
    run(k.id, async () => {
      await identity.removePasskey(k.id);
      await refresh();
      say(`${k.label ?? "That passkey"} no longer opens the house.`);
    });
  const codes = () =>
    run("codes", async () => {
      const r = await identity.newRecoveryCodes();
      setNewCodes(r.recoveryCodes);
      await refresh();
    });
  const others = () =>
    run("others", async () => {
      const r = await identity.logoutOthers();
      say(r.signedOut === 0 ? "No other device was signed in." : `${r.signedOut} other ${r.signedOut === 1 ? "device" : "devices"} signed out.`);
    });

  return (
    <Card
      title="Your keys"
      action={
        <Button kind="soft" onClick={add} disabled={busy !== null} aria-busy={busy === "add"} data-testid="add-passkey">
          {busy === "add" ? "Waiting for your device…" : "Add a passkey to this device"}
        </Button>
      }
    >
      {keys === null ? (
        <p className="text-[13px] text-ash">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-[14px]" data-testid="no-passkeys">
          <span className="font-medium">No passkey yet.</span> <span className="text-ash">You signed in with a {session.method === "recovery" ? "recovery code" : "code"}; add a passkey so this device can open the house on its own.</span>
        </p>
      ) : (
        <ul className="divide-y divide-ink/6" data-testid="passkeys">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
              <div>
                <div className="font-medium">{k.label ?? "Passkey"}</div>
                <div className="text-[12px] text-ash">
                  Added {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              <Button kind="quiet" onClick={() => remove(k)} disabled={busy !== null || keys.length <= 1} title={keys.length <= 1 ? "Keep at least one passkey" : undefined}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/6 pt-4 text-[13px]">
        <div className="flex items-center gap-2">
          <Pill tone={codesLeft > 2 ? "good" : "warn"}>{codesLeft} recovery codes left</Pill>
          <Button kind="quiet" onClick={codes} disabled={busy !== null}>
            New set
          </Button>
        </div>
        <Button kind="quiet" onClick={others} disabled={busy !== null}>
          Sign out other devices
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-ask">
          {error}
        </p>
      )}

      <Dialog open={newCodes !== null} onClose={() => setNewCodes(null)} kicker="Shown once" title="Your new recovery codes" size="md">
        <ol className="mt-4 grid grid-cols-2 gap-2 font-mono text-[15px]">
          {(newCodes ?? []).map((c) => (
            <li key={c} className="rounded-[8px] bg-bone px-3 py-2 text-center tracking-wider">
              {c}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] text-ash">The previous set stopped working. Write these down and keep them away from the box.</p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={() => setNewCodes(null)}>
            I have written them down
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
