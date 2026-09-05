"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
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
    <main
      data-theme="light"
      className="flex min-h-svh flex-col items-center justify-center bg-bone px-6 py-24 text-center text-ink"
    >
      <span className="orb" style={{ ["--orb" as string]: "14px" }} />
      <h1 className="mt-12 font-display text-[32px] font-medium tracking-[-0.02em]">
        Something on this page failed.
      </h1>
      <p className="mt-2 max-w-[420px] text-[15px] text-ash">The box, at least, is fine.</p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">Ref {error.digest}</p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </main>
  );
}
