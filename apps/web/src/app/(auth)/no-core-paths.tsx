"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth";
import { explain, identity, sessionRecord } from "@/lib/core/identity";
import { connectTo, retryCore, useCore } from "@/lib/core/store";

/** The hosted example house, when this build knows of one. Set at build time; absent inside a real house. */
const DEMO_CORE = process.env.NEXT_PUBLIC_WOVEN_DEMO_CORE?.replace(/\/+$/, "") ?? "";

/**
 * What a person can actually do when there is no Core to sign in to. Shown in
 * place of a disabled button, because a disabled button says "no" and a person
 * on this page came to say "yes" to something: walk through the example house,
 * run a Core on their own Mac, or reserve one.
 */
export function NoCorePaths() {
  const core = useCore();
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searching = core.phase === "searching";

  const tryDemo = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await connectTo(DEMO_CORE))) throw new Error("The demo house is not answering right now.");
      const view = await identity.demo(clean);
      signIn(sessionRecord(view, "demo"));
      router.replace("/dashboard");
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  return (
    <div role="status" className="mt-6 rounded-[12px] bg-ask-bg p-4 text-[13px] text-ink ring-1 ring-amber/30" data-testid="no-core-paths">
      <div className="font-medium">{searching ? "Looking for your Core…" : "There is no Core here to sign in to."}</div>
      <p className="mt-1 text-ash">
        Woven signs you in on your own Core, inside your house. This page cannot do that by itself, and there is no account to make here instead.
      </p>

      {DEMO_CORE && !searching && (
        <div className="mt-4 rounded-[10px] bg-white/70 p-3 ring-1 ring-ink/5">
          {asking ? (
            <form onSubmit={tryDemo} noValidate>
              <label htmlFor={id} className="block text-[13px] font-medium">
                What should the house call you?
              </label>
              <input
                id={id}
                type="text"
                autoComplete="given-name"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                autoFocus
                className="mt-1.5 w-full rounded-[10px] border border-ink/10 bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-ink disabled:opacity-60"
                placeholder="Your first name"
              />
              {error && (
                <p role="alert" className="mt-2 text-[13px] text-[#a13a2a]">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || !name.trim()} aria-busy={busy || undefined} className="btn btn-primary mt-3 w-full disabled:opacity-60">
                {busy ? "Opening the house…" : "Walk in"}
              </button>
              <p className="mt-2 text-[12px] text-ash">An example household, shared with whoever else is looking around, wiped every night. Nothing you do in it is kept.</p>
            </form>
          ) : (
            <>
              <div className="font-medium">Try the example house</div>
              <p className="mt-0.5 text-ash">The real dashboard on a real Core, with a family already living in it. Give a name and walk in.</p>
              <button type="button" onClick={() => setAsking(true)} className="btn btn-primary mt-3 w-full" data-testid="try-demo">
                Try the demo house
              </button>
            </>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-1.5">
        <li>
          <Link href="/mac" className="font-medium underline decoration-amber decoration-2 underline-offset-4">
            Run a Core on your Mac
          </Link>{" "}
          <span className="text-ash">— free, one command, and this page will find it.</span>
        </li>
        <li>
          <Link href="/order" className="font-medium underline decoration-amber decoration-2 underline-offset-4">
            Reserve a Core
          </Link>{" "}
          <span className="text-ash">— the box, built for your house.</span>
        </li>
        <li>
          <Link href="/account" className="font-medium underline decoration-amber decoration-2 underline-offset-4">
            Your Woven account
          </Link>{" "}
          <span className="text-ash">— reservations and support; not a house.</span>
        </li>
        {core.phase === "unreachable" && (
          <li>
            <button type="button" onClick={retryCore} className="font-medium underline decoration-amber decoration-2 underline-offset-4">
              Look again
            </button>{" "}
            <span className="text-ash">— if your Core is on this network and just woke up.</span>
          </li>
        )}
      </ul>
    </div>
  );
}
