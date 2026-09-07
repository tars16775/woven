"use client";

import { useState } from "react";
import { Button, Card, Field, PageHeader, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { ThemeControl } from "@/components/dashboard/theme";
import { LanguageControl } from "@/components/dashboard/language";
import { PasskeysCard } from "@/components/dashboard/passkeys-card";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { DataRightsCard } from "@/components/dashboard/data-rights-card";
import { BackupTokensCard } from "@/components/dashboard/backup-tokens-card";
import { RemoteCard } from "@/components/dashboard/remote-card";
import { NotificationsCard } from "@/components/dashboard/notifications-card";
import { useSession } from "@/lib/auth";
import { resetGuide, useSeenCount } from "@/lib/dashboard/guide";
import { startTour } from "@/components/dashboard/tour";
import { explain, identity } from "@/lib/core/identity";
import type { Person as CorePerson } from "@woven/schema";
import { RoomNote } from "@/components/dashboard/room-note";

type Open = null | "transfer" | "reset";

/** Settings for the household this browser is signed in to. Every card reads its own Core. */
export function SettingsView() {
  const say = useToast();
  const session = useSession();
  const seen = useSeenCount();
  const [transferTo, setTransferTo] = useState<CorePerson[] | null>(null);
  const [transferPick, setTransferPick] = useState("");
  const [open, setOpen] = useState<Open>(null);

  const close = () => setOpen(null);

  const transfer = async () => {
    if (!transferPick || !session?.email) return;
    try {
      const r = await identity.transferOwnership(transferPick, session.email);
      close();
      say(r.status === "succeeded" ? "Ownership transferred. You are now an adult member; sign in again to refresh your role." : r.decision.reason);
      setTransferTo(null);
    } catch (err) {
      say(explain(err));
    }
  };

  const reset = () => {
    close();
    say("Factory reset requires the button on the box. Hold it for ten seconds.");
  };

  return (
    <div>
      <PageHeader title="Settings" sub={session?.household ?? ""} />

      <RoomNote id="room:settings" />

      <PasskeysCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HouseholdCard
          onTransfer={(people) => {
            setTransferTo(people.filter((p) => p.role === "adult"));
            setTransferPick(people.find((p) => p.role === "adult")?.id ?? "");
            setOpen("transfer");
          }}
        />
        <DataRightsCard />
        <BackupTokensCard />
        <RemoteCard />
        <NotificationsCard />

        <Card title="Integrations">
          <p className="text-[14px] text-ash">
            Nothing is connected. This Core talks to nothing outside the house except what you approve at the Gate, crossing by crossing.
          </p>
        </Card>

        <Card title="Guidance">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-[46ch]">
              <div className="text-[14px] font-medium">Show the introductions again</div>
              <div className="mt-0.5 text-[13px] leading-relaxed text-ash">
                The welcome, the walkthrough and the one-off note at the top of each room. Yours only, on this browser.
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => startTour()}>Take the walkthrough</Button>
              <Button
                kind="soft"
                onClick={() => {
                  resetGuide(session?.personId);
                  say("The introductions will show again as you open each room.");
                }}
                disabled={seen === 0}
              >
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Appearance">
          <LanguageControl />
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
              ["What answers", "Rules over the box's own data · no language model on this Core yet"],
              ["Where it runs", "Inside · nothing crosses the Gate for a question"],
              ["Memory", "Per person · view, edit, delete in Privacy"],
              ["Spend limit", "$50 per order before approval is asked · from the policy engine"],
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

      <Dialog open={open === "transfer"} onClose={close} kicker="Class H · strong auth" title="Transfer ownership?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          You confirm with your passkey on this device. You become an adult member and your recovery codes stop working. Everyone&apos;s files stay where they
          are.
        </p>
        <Field label="New owner">
          {transferTo && transferTo.length > 0 ? (
            <select className={inputClass} value={transferPick} onChange={(e) => setTransferPick(e.target.value)}>
              {transferTo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[13px] text-ash">Invite another adult first; ownership can only pass to an adult.</p>
          )}
        </Field>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={close} data-autofocus>
            Cancel
          </Button>
          <Button kind="danger" className="flex-1 py-2.5" onClick={transfer} disabled={!transferPick}>
            Confirm with passkey
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open === "reset"} onClose={close} kicker="Class H · on the box only" title="Factory reset" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          A reset wipes every file, photo, memory and key on the box. It cannot be started from here: hold the button on the back of the box for ten seconds
          and confirm on its screen.
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
