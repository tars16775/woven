"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Pill, inputClass } from "@/components/dashboard/ui";
import { connectRemote, connectTo, retryCore, useCore } from "@/lib/core/store";
import { loadPairing } from "@/lib/core/remote";
import { hostOf } from "@/lib/core/format";

/**
 * Shown on the Core page when the dashboard cannot reach a Core. Says what
 * to do in three steps, and takes an address for households whose Core does
 * not answer to woven.local yet.
 */
export function ConnectCore() {
  const core = useCore();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (core.phase === "off" || core.phase === "connected") return null;
  const searching = core.phase === "searching";
  const pairing = loadPairing();
  const away = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    const ok = await connectRemote();
    setBusy(false);
    if (!ok) setFailed("The relay did not reach your Core. Is it running at home, with remote access on?");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || busy) return;
    setBusy(true);
    setFailed(null);
    const ok = await connectTo(address);
    setBusy(false);
    if (!ok) setFailed(`Nothing answered at ${hostOf(address)}.`);
  };

  return (
    <Card dark className="mb-4" title="Connect to your Core" action={searching ? <Pill tone="warn">Looking…</Pill> : <Pill tone="dark">Preview data</Pill>} id="connect">
      <p className="text-[14px] text-ash-2">
        {searching
          ? "Looking for your Core on this network. Most homes answer within a second or two."
          : "This dashboard is showing preview data. When your Core is reachable, every screen switches to the real thing."}
      </p>
      <ol className="mt-4 grid gap-3 text-[14px] sm:grid-cols-3">
        {[
          ["Same network", "Be on the home Wi-Fi or Ethernet. The Core never listens from the internet."],
          ["Trust it once", "On a new device open http://woven.local:4001 and install the household certificate."],
          ["Then retry", "The Core answers at https://woven.local:4000. Or type its address below."],
        ].map(([k, v], i) => (
          <li key={k} className="grid grid-cols-[28px_1fr] gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 font-mono text-[12px] text-bone">{i + 1}</span>
            <div>
              <div className="font-medium">{k}</div>
              <div className="mt-0.5 text-[13px] text-ash-2">{v}</div>
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="core-address">
          Core address
        </label>
        <input
          id="core-address"
          className={`${inputClass} min-w-0 flex-1 bg-white/5 text-bone ring-white/15 placeholder:text-ash-2`}
          placeholder="woven.local or 192.168.1.20"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <Button kind="primary" type="submit" disabled={busy || !address.trim()} aria-busy={busy}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
        {pairing && (
          <Button kind="soft" onClick={away} disabled={busy || searching} data-testid="connect-remote">
            Reach {pairing.household || "it"} from away
          </Button>
        )}
        <Button kind="soft" onClick={retryCore} disabled={searching}>
          Look again
        </Button>
      </form>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] text-ask">
          {failed}
        </p>
      )}
      {core.phase === "unreachable" && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ash-2">
          Tried {core.tried.map(hostOf).join(", ")} · {core.reason}
        </p>
      )}
    </Card>
  );
}
