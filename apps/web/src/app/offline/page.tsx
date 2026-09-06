import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** What the service worker shows when neither the network nor the cache has a page (gap 16). */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-bone px-6 text-ink">
      <div className="w-full max-w-[420px] rounded-[16px] bg-white p-7 ring-1 ring-ink/8">
        <Wordmark className="h-[16px]" />
        <h1 className="mt-6 font-display text-[24px] font-medium tracking-[-0.01em]">No connection to the house</h1>
        <p className="mt-2 text-[14px] text-ash">This page is not in the cache and the network is away. The dashboard itself opens offline; the Core&apos;s answers need a connection, at home or through the relay.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6 w-full">
          Open the dashboard
        </Link>
      </div>
    </main>
  );
}
