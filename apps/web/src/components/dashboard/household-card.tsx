"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explain, identity } from "@/lib/core/identity";
import { useSession } from "@/lib/auth";
import type { Invitation, Person } from "@woven/schema";

type Role = "adult" | "child" | "guest";

/**
 * The household as the Core knows it (phases 7, 10, 11): members with
 * roles, invitations as links that work once, guests that expire, and the
 * owner's controls to remove people or delete an account.
 */
export function HouseholdCard({ onTransfer }: { onTransfer?: (people: Person[]) => void }) {
  const session = useSession();
  const say = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [open, setOpen] = useState<null | "invite" | "link">(null);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("adult");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Person | null>(null);

  const refresh = async () => {
    const [h, inv] = await Promise.all([identity.household(), identity.invitations().catch(() => [] as Invitation[])]);
    if (h.setup) setPeople(h.people);
    setInvites(inv);
  };
  useEffect(() => {
    let alive = true;
    void Promise.all([identity.household(), identity.invitations().catch(() => [] as Invitation[])]).then(([h, inv]) => {
      if (!alive) return;
      if (h.setup) setPeople(h.people);
      setInvites(inv);
    });
    return () => {
      alive = false;
    };
  }, []);

  const me = people.find((p) => p.id === session?.personId);
  const canInvite = me?.role === "owner" || me?.role === "adult";
  const pendingIds = new Set(invites.map((i) => i.person.id));

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const inv = await identity.invite({ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}), role, ...(role === "guest" ? { guestDays: days } : {}) });
      const url = `${window.location.origin}/join?token=${encodeURIComponent(inv.token ?? "")}`;
      setLink({ name: inv.person.name, url });
      setOpen("link");
      setName("");
      setEmail("");
      await refresh();
    } catch (err) {
      say(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (inv: Invitation) => {
    try {
      await identity.withdrawInvitation(inv.id);
      await refresh();
      say(`${inv.person.name}'s invitation is withdrawn.`);
    } catch (err) {
      say(explain(err));
    }
  };

  const deleteAccount = async () => {
    if (!confirmDelete) return;
    try {
      const r = await identity.deleteAccount(confirmDelete.id);
      say(`${confirmDelete.name}'s account is gone: ${r.files} files and ${r.objects} objects removed. The ledger keeps that it happened.`);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      say(explain(err));
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      say("Link copied. Send it to them however you like; it works once and for seven days.");
    } catch {
      say("Select the link and copy it.");
    }
  };

  return (
    <Card
      title="Household"
      action={
        <div className="flex gap-2">
          {onTransfer && me?.role === "owner" && (
            <Button kind="quiet" onClick={() => onTransfer(people)}>
              Transfer ownership
            </Button>
          )}
          {canInvite && (
            <Button kind="soft" onClick={() => setOpen("invite")} data-testid="invite">
              Invite
            </Button>
          )}
        </div>
      }
    >
      <ul className="divide-y divide-ink/6" data-testid="members">
        {people.map((p) => {
          const pending = pendingIds.has(p.id);
          return (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium ${pending ? "bg-chassis text-ash" : "bg-ink text-bone"}`}>{p.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <div className="text-[14px] font-medium">
                    {p.name}
                    {p.id === session?.personId ? <span className="text-ash"> · you</span> : null}
                  </div>
                  <div className="text-[12px] text-ash">
                    {pending ? "Invited · waiting for a passkey" : p.email ?? "No email · signs in with the screen code"}
                    {p.expiresAt ? ` · leaves ${new Date(p.expiresAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pending ? <Pill tone="warn">Pending</Pill> : <Pill tone={p.role === "owner" ? "dark" : "neutral"}>{p.role}</Pill>}
                {pending && canInvite && (
                  <Button kind="quiet" onClick={() => void withdraw(invites.find((i) => i.person.id === p.id)!)}>
                    Withdraw
                  </Button>
                )}
                {!pending && me?.role === "owner" && p.role !== "owner" && (
                  <Button kind="quiet" onClick={() => setConfirmDelete(p)} aria-label={`Delete ${p.name}'s account`}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={open === "invite"} onClose={() => setOpen(null)} kicker="Household" title="Invite someone">
        <form onSubmit={invite} className="mt-4 space-y-4">
          <Field label="Name" hint="The house will know them by this.">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" data-autofocus required />
          </Field>
          <Field label="Email (optional)" hint="For passkey sign-in by email and recovery. Children can skip it and use the screen code.">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="adult">Adult · sees shared folders, controls the home</option>
              <option value="child">Child · own space, no locks or purchases</option>
              <option value="guest">Guest · limited, expires</option>
            </select>
          </Field>
          {role === "guest" && (
            <Field label="Days of access">
              <input className={inputClass} type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} />
            </Field>
          )}
          <DialogActions>
            <Button kind="primary" type="submit" className="flex-1 py-2.5" disabled={!name.trim() || busy} aria-busy={busy}>
              {busy ? "Making the link…" : "Make an invitation link"}
            </Button>
            <Button kind="soft" className="flex-1 py-2.5" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={open === "link"} onClose={() => setOpen(null)} kicker="Works once · seven days" title={`A link for ${link?.name ?? ""}`}>
        <p className="mt-2 text-[14px] text-ash">Send this however you like. Opening it on their device on the home network makes their passkey and signs them in.</p>
        <p className="mt-3 break-all rounded-[8px] bg-bone p-3 font-mono text-[12px]" data-testid="invite-link">
          {link?.url}
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={copy} data-autofocus>
            Copy link
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setOpen(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} kicker="Data rights · cannot be undone" title={`Delete ${confirmDelete?.name ?? ""}'s account?`} tone="ask">
        <p className="mt-2 text-[14px] text-ash">Their sessions and passkeys stop now; their files and objects are removed from the box. The ledger keeps only that it happened, not what was there.</p>
        <DialogActions>
          <Button kind="danger" className="flex-1 py-2.5" onClick={deleteAccount}>
            Delete the account
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirmDelete(null)} data-autofocus>
            Keep it
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
