"use client";

import Link from "next/link";
import { useEffect } from "react";

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
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="orb" style={{ ["--orb" as string]: "12px" }} />
      <h1 className="mt-10 font-display text-[28px] font-medium tracking-[-0.02em]">
        Something on this page failed.
      </h1>
      <p className="mt-2 max-w-[420px] text-[14px] text-ash">The box, at least, is fine.</p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">Ref {error.digest}</p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Overview
        </Link>
      </div>
    </div>
  );
}
