"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * When a room throws (design phase 27).
 *
 * Three things a person needs from an error and rarely gets: what broke, what
 * it means for their data, and what to do next. The second is the one that
 * matters here — a screen failing to render is not a box failing to hold
 * anything, and saying so is the difference between an annoyance and a
 * panic. Nothing is lost, nothing was sent, and the record is untouched,
 * because this is a browser problem and the box was never asked to change.
 *
 * The reference is shown rather than hidden, because a household running its
 * own machine can look in its own logs, and there is nobody else to ask.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-[560px] flex-col items-center justify-center px-6 py-16 text-center" role="alert">
      <span className="orb" style={{ ["--orb" as string]: "12px" }} />
      <h1 className="mt-10 font-display text-[28px] font-medium tracking-[-0.02em]">This page could not draw itself.</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ash">
        The failure is here in the browser, not on your Core. Nothing was written, nothing crossed the Gate, and your record is exactly as it was. Trying
        again usually works; if it does not, the other rooms will.
      </p>
      {error.digest && <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">Ref {error.digest}</p>}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Overview
        </Link>
      </div>
      <p className="mt-6 text-[12.5px] text-ash">
        If a room keeps failing, the{" "}
        <Link href="/dashboard/core" className="font-medium underline underline-offset-2">
          Core page
        </Link>{" "}
        can verify the ledger and write diagnostics with names and addresses scrubbed.
      </p>
    </div>
  );
}
