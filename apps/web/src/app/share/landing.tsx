"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";

type Info = { name: string; size: number; mime: string | null; expiresAt: string };

const fmt = (n: number) => (n < 1e6 ? `${(n / 1e3).toFixed(0)} KB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`);

/**
 * Served by the Core itself, so the file comes from the same origin the
 * link points at. The page asks the box whether the link is still live and
 * offers the one download; nothing else on the box is reachable from here.
 */
export function ShareLanding() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [info, setInfo] = useState<Info | null | "gone">(null);

  useEffect(() => {
    let alive = true;
    const look = token ? fetch(`/v1/s/${encodeURIComponent(token)}/info`, { cache: "no-store" }).then(async (r) => (r.ok ? ((await r.json()) as Info) : ("gone" as const))) : Promise.resolve("gone" as const);
    look.catch(() => "gone" as const).then((v) => alive && setInfo(v));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-bone px-6 text-ink">
      <div className="w-full max-w-[440px] rounded-[16px] bg-white p-7 ring-1 ring-ink/8">
        <Wordmark className="h-[16px]" />
        {info === null ? (
          <p className="mt-6 text-[14px] text-ash">Checking the link with the house…</p>
        ) : info === "gone" ? (
          <>
            <h1 className="mt-6 font-display text-[24px] font-medium tracking-[-0.01em]">This link is not live</h1>
            <p className="mt-2 text-[14px] text-ash">It expired, was revoked, reached its download limit, or never existed. Ask whoever sent it for a new one.</p>
          </>
        ) : (
          <>
            <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">Shared from a Woven home</div>
            <h1 className="mt-2 break-words font-display text-[24px] font-medium tracking-[-0.01em]" data-testid="share-name">
              {info.name}
            </h1>
            <p className="mt-1 text-[13px] text-ash">
              {fmt(info.size)}
              {info.mime ? ` · ${info.mime}` : ""} · link ends {new Date(info.expiresAt).toLocaleString()}
            </p>
            <a href={`/v1/s/${encodeURIComponent(token)}`} className="btn btn-primary mt-6 w-full" data-testid="share-download">
              Download
            </a>
            <p className="mt-4 text-[12px] text-ash">The file comes straight from the household&apos;s own Core. Nothing about you is kept; the house sees only that the link was used.</p>
          </>
        )}
      </div>
    </main>
  );
}
