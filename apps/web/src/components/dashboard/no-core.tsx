"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { connectRemote, connectTo, retryCore, useCore } from "@/lib/core/store";
import { loadPairing } from "@/lib/core/remote";
import { hostOf } from "@/lib/core/format";

/**
 * What the dashboard shows when there is no Core answering. It is the whole
 * screen, not a banner over a pretend house: there is no sample household in
 * this app, so when the box is not there, there is nothing to show and the
 * page says what to do about it.
 */
export function NoCore() {
  const core = useCore();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<null | "address" | "relay">(null);
  const [failed, setFailed] = useState<string | null>(null);
  const searching = core.phase === "searching";
  const pairing = typeof window === "undefined" ? null : loadPairing();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || busy) return;
    setBusy("address");
    setFailed(null);
    const ok = await connectTo(address);
    setBusy(null);
    if (!ok) setFailed(`Nothing answered at ${hostOf(address)}.`);
  };

  const away = async () => {
    if (busy) return;
    setBusy("relay");
    setFailed(null);
    const ok = await connectRemote();
    setBusy(null);
    if (!ok) setFailed("The relay did not reach your Core. Is it running at home, with remote access on?");
  };

  return (
    <div className="mx-auto max-w-[720px] py-6" data-testid="no-core">
      <span className="orb" style={{ ["--orb" as string]: "14px" }} />
      <h1 className="mt-8 font-display text-[32px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[40px]">
        {searching ? "Looking for your Core…" : "No Core is answering."}
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-ash">
        {searching
          ? "Trying the home network, then the relay if this browser is paired."
          : "This dashboard only ever shows a real house. There is no sample household behind it, so until a Core answers there is nothing here to show you."}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="rounded-[14px] bg-white p-5 ring-1 ring-ink/5">
          <h2 className="text-[15px] font-medium">You have a Core at home</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ash">
            Be on the same network and it is found by name. On a new device, open the trust page once so the browser accepts the household certificate.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={retryCore} disabled={searching} className="btn btn-secondary min-w-0! w-auto! px-4 text-[13px]!">
              {searching ? "Looking…" : "Look again"}
            </button>
            {pairing && (
              <button type="button" onClick={away} disabled={busy !== null} className="btn btn-secondary min-w-0! w-auto! px-4 text-[13px]!" data-testid="reach-from-away">
                {busy === "relay" ? "Reaching…" : `Reach ${pairing.household || "it"} from away`}
              </button>
            )}
          </div>
          <form onSubmit={submit} className="mt-4 flex gap-2">
            <label htmlFor="core-address" className="sr-only">
              Core address
            </label>
            <input
              id="core-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="woven.local or 192.168.1.20"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-[8px] bg-bone px-3 py-2 text-[13.5px] ring-1 ring-ink/8"
            />
            <button type="submit" disabled={busy !== null || !address.trim()} className="btn btn-primary min-w-0! w-auto! px-4 text-[13px]!">
              Connect
            </button>
          </form>
        </section>

        <section className="rounded-[14px] bg-graphite p-5 text-bone ring-1 ring-white/8">
          <h2 className="text-[15px] font-medium">You do not have one yet</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ash-2">
            A Core runs on a Mac you already own. It is the same software the box will run, it is free, and it takes about a minute to set up a house.
          </p>
          <Link href="/mac" className="btn btn-primary mt-4 min-w-0! w-auto! px-4 text-[13px]!">
            Run one on your Mac
          </Link>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ash-2">
            What the software does today, and what waits on the box, is{" "}
            <Link href="/status" className="font-medium text-bone underline decoration-amber decoration-2 underline-offset-4">
              listed claim by claim
            </Link>
            .
          </p>
        </section>
      </div>

      {failed && (
        <p role="alert" className="mt-6 text-[13px] text-ask">
          {failed}
        </p>
      )}
      {core.phase === "unreachable" && core.tried.length > 0 && (
        <p className="mt-6 text-[12.5px] text-ash">Tried: {core.tried.join(", ")}.</p>
      )}
    </div>
  );
}
