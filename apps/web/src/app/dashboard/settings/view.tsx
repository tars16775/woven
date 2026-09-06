"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Field, PageHeader, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { ThemeControl } from "@/components/dashboard/theme";
import { PasskeysCard } from "@/components/dashboard/passkeys-card";
import { household, people as initialPeople, type Person } from "@/lib/dashboard/data";

type Integration = { name: string; detail: string; tone: "good" | "warn" };

const initialIntegrations: Integration[] = [
  { name: "Home Assistant", detail: "Running inside the box", tone: "good" },
  { name: "Google Calendar", detail: "Read only · Alex, Maya", tone: "good" },
  { name: "iCloud Photos", detail: "Import once, then inside", tone: "good" },
  { name: "Crossings", detail: "Anthropic · OpenAI, by task, through the Gate", tone: "warn" },
];

type Member = Person & { pending?: boolean };
type Open = null | "invite" | "transfer" | "reset";

export function SettingsView() {
  const say = useToast();
  const [people, setPeople] = useState<Member[]>(initialPeople);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [revoking, setRevoking] = useState<Integration | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Person["role"]>("adult");

  const close = () => setOpen(null);

  const invite = (e: FormEvent) => {
    e.preventDefault();
    const name = inviteName.trim();
    if (!name) return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    setPeople((p) => [...p, { id, name, role: inviteRole, initial: name.slice(0, 1).toUpperCase(), devices: 0, lastBackup: "Never", pending: true }]);
    setInviteName("");
    setInviteRole("adult");
    close();
    say(`${name} is invited. They finish joining on the box's screen.`);
  };

  const revoke = () => {
    if (!revoking) return;
    setIntegrations((is) => is.filter((i) => i.name !== revoking.name));
    say(`${revoking.name} revoked. Its credentials stopped working now.`);
    setRevoking(null);
  };

  const transfer = () => {
    close();
    say("Transfer started. The new owner confirms with a passkey on the box's screen.");
  };

  const reset = () => {
    close();
    say("Factory reset requires the button on the box. Hold it for ten seconds.");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Settings" sub={`${household.name} · ${household.city}`} />

      <PasskeysCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Household"
          action={
            <Button kind="soft" onClick={() => setOpen("invite")}>
              Invite
            </Button>
          }
        >
          <ul className="divide-y divide-ink/6">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium ${p.pending ? "bg-chassis text-ash" : "bg-ink text-bone"}`}>
                    {p.initial}
                  </span>
                  <div>
                    <div className="text-[14px] font-medium">{p.name}</div>
                    <div className="text-[12px] text-ash">{p.pending ? "Invited · waiting for a passkey" : `Passkey · ${p.devices} devices`}</div>
                  </div>
                </div>
                {p.pending ? <Pill tone="warn">Pending</Pill> : <Pill tone={p.role === "owner" ? "dark" : "neutral"}>{p.role}</Pill>}
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <div className="text-[14px] text-ash">Guest access</div>
              <span className="text-[12px] text-ash">None active · expires automatically</span>
            </li>
          </ul>
        </Card>

        <Card title="Integrations">
          {integrations.length > 0 ? (
            <ul className="divide-y divide-ink/6">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-[14px] font-medium">{i.name}</div>
                    <div className="text-[12px] text-ash">{i.detail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={i.tone}>{i.tone === "good" ? "Connected" : "By approval"}</Pill>
                    <Button kind="quiet" onClick={() => setRevoking(i)} aria-label={`Revoke ${i.name}`}>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-ash">Nothing connected. The box runs on its own.</p>
          )}
        </Card>

        <Card title="Appearance">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-medium">Colour scheme</div>
              <div className="mt-0.5 text-[12px] text-ash">System follows this device. Saved on this browser only.</div>
            </div>
            <ThemeControl />
          </div>
        </Card>

        <Card title="Assistant">
          <ul className="divide-y divide-ink/6 text-[14px]">
            {[
              ["Wake word", "“Tandem” · processed on the box"],
              ["Where it runs", "Inside first · crosses the Gate only when you approve"],
              ["Memory", "Per person · view, edit, delete in Privacy"],
              ["Spend limit for agents", "$50 per order · approved merchants"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <span className="font-medium">{k}</span>
                <span className="text-right text-[13px] text-ash">{v}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Danger">
          <ul className="divide-y divide-ink/6 text-[14px]">
            <li className="flex items-center justify-between gap-4 py-2.5 pt-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Transfer ownership</span>
                  <Pill tone="warn">Class H</Pill>
                </div>
                <div className="text-[12px] text-ash">Strong authentication · revokes the previous owner</div>
              </div>
              <Button onClick={() => setOpen("transfer")}>Transfer</Button>
            </li>
            <li className="flex items-center justify-between gap-4 py-2.5 pb-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Factory reset</span>
                  <Pill tone="warn">Class H</Pill>
                </div>
                <div className="text-[12px] text-ash">Wipes household data and keys · cannot be undone</div>
              </div>
              <Button onClick={() => setOpen("reset")}>Reset</Button>
            </li>
          </ul>
        </Card>
      </div>

      <Dialog open={open === "invite"} onClose={close} kicker="Household" title="Invite someone">
        <form onSubmit={invite} className="mt-4 space-y-4">
          <Field label="Name" hint="They pick a passkey on the box's screen. No email needed.">
            <input className={inputClass} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Priya" data-autofocus required />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Person["role"])}>
              <option value="adult">Adult · sees shared folders, controls the home</option>
              <option value="child">Child · own space, no locks or purchases</option>
              <option value="guest">Guest · Wi-Fi and the TV, expires in 7 days</option>
            </select>
          </Field>
          <DialogActions>
            <Button kind="primary" type="submit" className="flex-1 py-2.5" disabled={!inviteName.trim()}>
              Send invite
            </Button>
            <Button kind="soft" className="flex-1 py-2.5" onClick={close}>
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={revoking !== null} onClose={() => setRevoking(null)} kicker="Reversible · reconnect any time" title={`Revoke ${revoking?.name ?? ""}?`}>
        <p className="mt-2 text-[14px] text-ash">
          Its credentials stop working now and nothing new is read or sent. What it already brought inside stays yours.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={revoke} data-autofocus>
            Revoke
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setRevoking(null)}>
            Keep
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "transfer"} onClose={close} kicker="Class H · strong auth" title="Transfer ownership?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          The new owner confirms with their passkey on the box&apos;s screen. You become an adult member and lose the recovery key. Everyone&apos;s files stay where they are.
        </p>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button kind="danger" className="flex-1 py-2.5" onClick={transfer}>
            Start transfer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "reset"} onClose={close} kicker="Class H · on the box only" title="Factory reset" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          A reset wipes every file, photo, memory and key on the box. It cannot be started from here: hold the button on the back of the box for ten seconds and confirm on its screen.
        </p>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button kind="danger" className="flex-1 py-2.5" onClick={reset}>
            I understand
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
