"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./globals.css";

/**
 * Last resort when the root layout itself fails. It must render its own
 * <html> and <body>, and the loaded fonts are gone, so it leans on the
 * system stack and the tokens in globals.css.
 */
export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main
          data-theme="light"
          className="flex min-h-svh flex-col items-center justify-center bg-bone px-6 py-24 text-center text-ink"
        >
          <span className="orb" style={{ ["--orb" as string]: "14px" }} />
          <h1 className="mt-12 font-display text-[32px] font-medium tracking-[-0.02em]">
            Something on this page failed.
          </h1>
          <p className="mt-2 max-w-[420px] text-[15px] text-ash">The box, at least, is fine.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button type="button" onClick={() => reset()} className="btn btn-primary">
              Try again
            </button>
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
