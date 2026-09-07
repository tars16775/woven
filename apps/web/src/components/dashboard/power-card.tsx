"use client";

import { useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { system } from "@/lib/core/files";
import { refreshCore, useCore } from "@/lib/core/store";
import { useSession } from "@/lib/auth";

/**
 * The kill switch. Off is a state the Core holds: the Gate closes, the
 * relay drops, every job stops and every route but this one answers 503.
 * The dashboard keeps being served so the switch can be flipped back. Only
 * the owner flips it; everyone sees it.
 */
export function PowerCard({ compact = false }: { compact?: boolean }) {
  const core = useCore();
  const session = useSession();
  const say = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = core.phase === "connected" ? core.status?.power : undefined;
  const isOwner = session?.role === "owner";
  const off = state?.power === "off";

  const flip = async (power: "on" | "off") => {
    if (busy) return;
    setBusy(true);
    setConfirm(false);
    try {
      await system.power(power);
      await refreshCore();
      say(power === "off" ? "The Core is off. Nothing runs, nothing leaves." : "The Core is on. The Gate stays closed until you open it.");
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(false);
    }
  };

  if (core.phase !== "connected") return null;

  return (
    <Card
      dark={off}
      className={compact ? "" : "mb-4"}
      title="Power"
      action={
        <Pill tone={off ? "warn" : "good"}>
          <span data-testid="power-state">{state ? (off ? "Off" : "On") : "…"}</span>
        </Pill>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[560px] text-[14px]">
          {off ? (
            <>
              <div className="font-medium">The Core is switched off.</div>
              <div className={`mt-1 ${off ? "text-ash-2" : "text-ash"}`}>
                Since {state?.since ? new Date(state.since).toLocaleString() : "a while"}. The Gate is closed, the relay is down, routines and the nightly job are stopped, and every screen answers with this until it is on again. Your data sits untouched.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">Everything on this Core is running.</div>
              <div className="mt-1 text-ash">Off stops it all at once: the Gate closes, the relay drops, routines and jobs pause, and the API refuses everything but this switch. Switching on brings it back; the Gate stays closed until you open it.</div>
            </>
          )}
        </div>
        {isOwner ? (
          off ? (
            <Button kind="primary" onClick={() => void flip("on")} disabled={busy} aria-busy={busy} data-testid="power-on">
              {busy ? "Starting…" : "Switch on"}
            </Button>
          ) : (
            <Button kind="danger" onClick={() => setConfirm(true)} disabled={busy} data-testid="power-off">
              Switch off
            </Button>
          )
        ) : (
          <span className="text-[13px] text-ash">Only the owner flips this.</span>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="The kill switch" title="Switch the Core off?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          The Gate closes, the relay disconnects, routines and the nightly snapshot stop, and every device gets a plain refusal until you switch it on again. Nothing is deleted. It stays off across a restart.
        </p>
        <DialogActions>
          <Button kind="danger" className="flex-1 py-2.5" onClick={() => void flip("off")} data-autofocus data-testid="power-off-confirm">
            Switch off
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirm(false)}>
            Keep it running
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
