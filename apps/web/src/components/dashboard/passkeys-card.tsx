"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { deviceLabel, explain, identity, type Passkey } from "@/lib/core/identity";
import { actions, describe } from "@/lib/core/actions";
import type { Person } from "@woven/schema";
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
  const [people, setPeople] = useState<Person[]>([]);
  const [rescue, setRescue] = useState<{ person: Person; code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = core.phase === "connected" && session && !session.simulated;

  const refresh = async () => {
    try {
      const r = await identity.passkeys();
      setKeys(r.passkeys);
      setCodesLeft(r.recoveryCodesLeft);
      const h = await identity.household();
      if (h.setup) setPeople(h.people.filter((p) => !p.removedAt));
    } catch (err) {
      setError(explain(err));
    }
  };

  useEffect(() => {
    if (!live) return;
    let alive = true;
    identity
      .passkeys()
      .then(async (r) => {
        if (!alive) return;
        setKeys(r.passkeys);
        setCodesLeft(r.recoveryCodesLeft);
        const h = await identity.household();
        if (alive && h.setup) setPeople(h.people.filter((p) => !p.removedAt));
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
  /** Gap 4: a trusted adult gives someone locked out a one-time code. Class H, confirmed with this person's passkey. */
  const helpBackIn = (person: Person) =>
    run(`rescue-${person.id}`, async () => {
      const prepared = await actions.prepare({ capability: "person.recover", target: "household", parameters: { personId: person.id } });
      if (prepared.status !== "prepared") throw new Error(describe(prepared));
      const assertion = await identity.assert(session.email || undefined);
      const approved = await actions.approve(prepared.id, assertion);
      if (approved.status !== "approved") throw new Error(describe(approved));
      const done = await actions.execute(prepared.id);
      if (done.status !== "succeeded" || !done.secret) throw new Error(describe(done));
      setRescue({ person, code: done.secret, expiresAt: String(done.observed?.expiresAt ?? "") });
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
          <Button kind={codesLeft > 2 ? "quiet" : "soft"} onClick={codes} disabled={busy !== null} data-testid="new-codes">
            {codesLeft > 2 ? "New set" : "Print a new set"}
          </Button>
        </div>
        <Button kind="quiet" onClick={others} disabled={busy !== null}>
          Sign out other devices
        </Button>
      </div>
      {codesLeft <= 2 && (
        <p className="mt-2 text-[13px] text-ash" data-testid="low-codes">
          {codesLeft === 0 ? "You have no recovery codes left." : `Only ${codesLeft} left.`} If every device is lost, these are the way back in. Print a new set and keep it away from the box.
        </p>
      )}

      {(session.role === "owner" || session.role === "adult") && people.some((p) => p.id !== session.personId && (p.role === "owner" || p.role === "adult")) && (
        <div className="mt-4 border-t border-ink/6 pt-4" data-testid="help-back-in">
          <div className="text-[13px] font-medium">Help someone back in</div>
          <p className="mt-1 text-[13px] text-ash">Lost every device and their paper codes? Confirm with your passkey and hand them a one-time code, good for 30 minutes.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {people
              .filter((p) => p.id !== session.personId && (p.role === "owner" || p.role === "adult"))
              .map((p) => (
                <li key={p.id}>
                  <Button kind="quiet" onClick={() => helpBackIn(p)} disabled={busy !== null} aria-busy={busy === `rescue-${p.id}`}>
                    {busy === `rescue-${p.id}` ? "Confirming…" : `Rescue ${p.name}`}
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-ask">
          {error}
        </p>
      )}

      <Dialog open={rescue !== null} onClose={() => setRescue(null)} kicker="Shown once · not stored on the box" title={rescue ? `A way back in for ${rescue.person.name}` : ""} size="md">
        <div className="mt-4 rounded-[8px] bg-bone px-3 py-3 text-center font-mono text-[22px] tracking-wider" data-testid="rescue-code">
          {rescue?.code}
        </div>
        <p className="mt-3 text-[13px] text-ash">
          Read it to them in person or over a call, never in writing. On the sign-in screen they choose “I lost my devices”, enter their email and this code, then add a passkey. It works once and stops at{" "}
          {rescue?.expiresAt ? new Date(rescue.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "the half hour"}.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={() => setRescue(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

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
