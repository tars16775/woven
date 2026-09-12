"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Block } from "@/components/page-frame";
import { accountsAvailable, supabase } from "@/lib/supabase";

type Reservation = { id: string; created_at: string; code: string; tier: string; total: string | number; status: string };
type Application = { id: string; created_at: string; code: string; city: string; status: string };
type Who = { id: string; email: string } | null | undefined;

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const money = (n: string | number) => Number(n).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Status words as a person would say them, not as the database does. */
const STATUS: Record<string, string> = { received: "Received", confirmed: "Build slot confirmed", built: "Built", cancelled: "Cancelled", reading: "Being read", accepted: "Accepted", declined: "Declined" };

export function AccountView() {
  // Unavailable is known before the first render, so it is the initial state
  // rather than something an effect discovers and sets.
  const [who, setWho] = useState<Who>(() => (accountsAvailable ? undefined : null));

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setWho(data.session?.user.email ? { id: data.session.user.id, email: data.session.user.email } : null));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => setWho(session?.user.email ? { id: session.user.id, email: session.user.email } : null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!accountsAvailable) {
    return (
      <Block title="Not on this copy">
        <p className="max-w-[560px] text-ash">
          This copy of the site was built without accounts; it is the one a Core serves inside a house. Your Woven account lives at{" "}
          <a href="https://woventechnology.com/account" className="font-medium text-ink">
            woventechnology.com/account
          </a>
          .
        </p>
      </Block>
    );
  }
  if (who === undefined) return <p className="text-ash">Reading…</p>;
  if (who === null) return <SignIn />;
  return <SignedIn who={who} />;
}

function SignIn() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb || !email.includes("@")) return;
    setState("sending");
    setError(null);
    const { error: err } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/account` } });
    if (err) {
      setError(err.message);
      setState("error");
    } else {
      setState("sent");
    }
  };

  if (state === "sent") {
    return (
      <Block title="Check your email">
        <p className="max-w-[560px] text-ash">
          A sign-in link is on its way to <span className="font-medium text-ink">{email.trim()}</span>. It works once and expires in an hour. If it has not arrived in a few
          minutes, look in spam, then{" "}
          <button type="button" onClick={() => setState("idle")} className="font-medium text-ink underline underline-offset-4">
            try again
          </button>
          .
        </p>
      </Block>
    );
  }

  return (
    <Block title="Sign in or create an account">
      <form onSubmit={submit} className="max-w-[420px]">
        <p className="text-ash">We email you a link. There is no password to make or forget, and the same link creates the account if you do not have one yet.</p>
        <label htmlFor={id} className="mt-5 block text-[13px] font-medium text-ash">
          Email
        </label>
        <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={state === "sending"} className="mt-1.5 w-full rounded-[10px] border bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink disabled:opacity-60 aria-[invalid=true]:border-[#a13a2a] border-ink/10" />
        {error && (
          <p role="alert" className="mt-3 text-[14px] text-ink">
            {error}
          </p>
        )}
        <button type="submit" disabled={state === "sending"} aria-busy={state === "sending" || undefined} className="btn btn-primary mt-5 w-full disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Email me a link"}
        </button>
      </form>
    </Block>
  );
}

function SignedIn({ who }: { who: { id: string; email: string } }) {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let live = true;
    void (async () => {
      // Row security decides what comes back: rows made while signed in, and
      // rows made with this email before there was an account.
      const [r, a] = await Promise.all([
        sb.from("reservations").select("id, created_at, code, tier, total, status").order("created_at", { ascending: false }),
        sb.from("applications").select("id, created_at, code, city, status").order("created_at", { ascending: false }),
      ]);
      if (!live) return;
      if (r.error || a.error) setError((r.error ?? a.error)?.message ?? "Could not read your account.");
      setReservations((r.data as Reservation[] | null) ?? []);
      setApplications((a.data as Application[] | null) ?? []);
    })();
    return () => {
      live = false;
    };
  }, [who.id]);

  return (
    <>
      <Block title="Signed in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-ash">
            as <span className="font-medium text-ink">{who.email}</span>
          </p>
          <button type="button" onClick={() => void supabase()?.auth.signOut()} className="btn btn-secondary">
            Sign out
          </button>
        </div>
      </Block>

      {error && (
        <p role="alert" className="text-ink">
          {error}
        </p>
      )}

      <Block title="Reservations">
        {reservations === null ? (
          <p className="text-ash">Reading…</p>
        ) : reservations.length === 0 ? (
          <p className="text-ash">
            None yet.{" "}
            <Link href="/order" className="font-medium text-ink">
              The configurator makes one.
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {reservations.map((r) => (
              <li key={r.id} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr_auto]">
                <div className="text-[13px] font-medium uppercase tracking-[0.1em] text-ash sm:pt-1">{r.code}</div>
                <div>
                  <div className="text-[16px] font-medium">
                    Woven {r.tier} · {money(r.total)}
                  </div>
                  <p className="mt-0.5 text-ash">
                    {STATUS[r.status] ?? r.status} · {when(r.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[13px] text-ash">Nothing is charged until we confirm a build slot with you, by email.</p>
      </Block>

      <Block title="Founding home applications">
        {applications === null ? (
          <p className="text-ash">Reading…</p>
        ) : applications.length === 0 ? (
          <p className="text-ash">
            None.{" "}
            <Link href="/founding-homes" className="font-medium text-ink">
              About the programme.
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {applications.map((a) => (
              <li key={a.id} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]">
                <div className="text-[13px] font-medium uppercase tracking-[0.1em] text-ash sm:pt-1">{a.code}</div>
                <div>
                  <div className="text-[16px] font-medium">{a.city}</div>
                  <p className="mt-0.5 text-ash">
                    {STATUS[a.status] ?? a.status} · {when(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Your house is not here">
        <p className="max-w-[560px] text-ash">
          This account holds what you told the company. Your files, photos, cameras and everything else inside the house live on your Core, and it signs you in itself under{" "}
          <Link href="/login" className="font-medium text-ink">
            Sign in
          </Link>
          . Nothing from there is ever sent here.
        </p>
      </Block>
    </>
  );
}
