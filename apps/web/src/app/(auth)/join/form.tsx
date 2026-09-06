"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth";
import { explain, identity, sessionRecord } from "@/lib/core/identity";
import { useCore } from "@/lib/core/store";

/**
 * The other end of an invitation (phase 10): the link names who you are
 * becoming; this device makes your first passkey; you are in.
 */
export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const core = useCore();
  const connected = core.phase === "connected";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const { session } = await identity.join(token);
      signIn(sessionRecord(session, "passkey"));
      router.replace("/dashboard");
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-[13px] font-medium text-ash">Join</p>
      <h1 className="mt-2 font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em]">You were invited.</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ash">
        Someone in the house sent you this link. Make a passkey on this device and the house will know you from now on. There is no password.
      </p>
      {!token ? (
        <p role="alert" className="mt-6 text-[13px] text-[#a13a2a]">
          This link is missing its invitation. Ask for it again.
        </p>
      ) : !connected ? (
        <p role="status" className="mt-6 rounded-[12px] bg-white p-4 text-[13px] ring-1 ring-ink/5">
          {core.phase === "searching" ? "Looking for the house's Core on this network…" : "Be on the home Wi-Fi to join; the Core only answers from inside the house."}
        </p>
      ) : (
        <>
          <button type="button" onClick={join} disabled={busy} aria-busy={busy || undefined} className="btn btn-primary mt-8 w-full disabled:opacity-60" data-testid="join">
            {busy ? "Making your key…" : "Make my passkey and join"}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[#a13a2a]">
              {error}
            </p>
          )}
        </>
      )}
      <div className="hairline mt-8 border-t pt-6 text-[13px] text-ash">
        Already in the house?{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          Sign in
        </Link>
      </div>
    </div>
  );
}
