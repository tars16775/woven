"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/lib/auth";
import { addons, cloudPlans, estimatedDelivery, finishes, storageOptions } from "@/lib/order";
import { cancelReservation, normalizeCode, useReservations, type Reservation } from "@/lib/orders";
import { formatPrice, tiers } from "@/lib/site";

const CODE_SHAPE = /^WV-[A-Z0-9]{4,10}$/;

/**
 * Every reservation this browser has made, newest first. `?code=` opens one
 * and puts its code in the tab title so the page can be bookmarked.
 */
export function ReservationList() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const list = useReservations();
  const uid = useId();
  const requested = params.get("code") ? normalizeCode(params.get("code") as string) : null;
  const opened = requested && list ? list.find((r) => r.code === requested) : undefined;
  const notFound = Boolean(requested && list && !opened);

  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookupRef = useRef<HTMLInputElement>(null);

  // The tab title carries the code of the reservation being looked at.
  useEffect(() => {
    if (opened) document.title = `${opened.code} | Woven`;
  }, [opened]);

  const open = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(lookup);
    if (!CODE_SHAPE.test(code)) {
      setLookupError("Codes look like WV-K7QM204. Check the one on your confirmation.");
      lookupRef.current?.focus();
      return;
    }
    setLookupError(null);
    router.replace(`/order/status?code=${encodeURIComponent(code)}`, { scroll: false });
  };

  const ordered = list ? [...(opened ? [opened] : []), ...list.filter((r) => r !== opened)] : undefined;

  return (
    <div data-theme="light" className="bg-bone text-ink">
      <div className="mx-auto max-w-[720px] px-6 pb-32 pt-28 lg:px-10 lg:pt-32">
        <p className="text-[13px] font-medium text-ash">Reserve</p>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em]">
          Your reservations.
        </h1>
        <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-ash">
          Reservations are saved in this browser until the ordering service exists. Nothing has been sent
          anywhere and no card has been asked for. Keep your code; it is how you find a reservation again.
        </p>
        {session && (
          <p className="mt-2 text-[13px] text-ash">
            Signed in as <span className="font-medium text-ink">{session.name}</span>
            {session.email ? <span> · {session.email}</span> : null}
          </p>
        )}

        {/* Open by code */}
        <form onSubmit={open} noValidate className="mt-8 rounded-[14px] bg-white p-5 ring-1 ring-ink/5">
          <label htmlFor={`${uid}-code`} className="block text-[13px] font-medium text-ash">
            Open a reservation by code
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id={`${uid}-code`}
              ref={lookupRef}
              value={lookup}
              onChange={(e) => {
                setLookup(e.target.value);
                if (lookupError) setLookupError(null);
              }}
              placeholder="WV-"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={lookupError ? true : undefined}
              aria-describedby={lookupError ? `${uid}-code-error` : `${uid}-code-hint`}
              className={`w-full rounded-[10px] border bg-white px-3.5 py-3 font-mono text-[15px] uppercase outline-none transition-colors focus:border-ink ${
                lookupError ? "border-[#a13a2a]" : "border-ink/10"
              }`}
            />
            <button type="submit" className="btn btn-secondary sm:!min-w-[120px]">
              Open
            </button>
          </div>
          {lookupError ? (
            <p id={`${uid}-code-error`} role="alert" className="mt-2 text-[13px] text-[#a13a2a]">
              {lookupError}
            </p>
          ) : (
            <p id={`${uid}-code-hint`} className="mt-2 text-[12px] text-ash">
              Only reservations made in this browser can be opened here.
            </p>
          )}
        </form>

        {notFound && requested && (
          <p role="status" className="mt-6 rounded-[10px] bg-ask-bg px-4 py-3 text-[13px] text-ink ring-1 ring-ask/20">
            No reservation <span className="font-mono">{requested}</span> on this device. Reservations live in
            the browser that made them; open this page there, or reserve again below.
          </p>
        )}

        {/* List */}
        <div className="mt-8 space-y-4" aria-live="polite">
          {ordered === undefined ? (
            <p className="text-[14px] text-ash">Looking on this device…</p>
          ) : ordered.length === 0 ? (
            <div className="rounded-[14px] bg-white p-6 ring-1 ring-ink/5">
              <div className="font-display text-[22px] font-medium tracking-[-0.02em]">Nothing held yet.</div>
              <p className="mt-2 text-[14px] text-ash">No reservations have been made in this browser.</p>
              <Link href="/order" className="btn btn-primary mt-5">
                Choose a Core
              </Link>
            </div>
          ) : (
            ordered.map((r) => <Card key={r.code} r={r} opened={r === opened} />)
          )}
        </div>

        {ordered && ordered.length > 0 && (
          <p className="mt-8 text-[13px] text-ash">
            Want another?{" "}
            <Link href="/order" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              Reserve a second box
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ r, opened }: { r: Reservation; opened: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const t = tiers[r.tier];
  const storageOpt = storageOptions[r.tier].find((s) => s.id === r.storage);
  const cloudOpt = cloudPlans.find((c) => c.id === r.cloud);
  const finishOpt = finishes.find((f) => f.id === r.finish);
  const chosen = r.addons.map((id) => addons.find((a) => a.id === id)).filter((a) => a !== undefined);
  const cancelled = r.status === "cancelled";
  const when = new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const confirmCancel = () => {
    if (busy) return;
    setBusy(true);
    cancelReservation(r.code);
    setBusy(false);
    setConfirming(false);
  };

  return (
    <article
      aria-labelledby={`${r.code}-title`}
      className={`rounded-[14px] bg-white p-6 ring-1 ${
        opened ? "ring-2 ring-amber" : "ring-ink/5"
      } ${cancelled ? "opacity-80" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium">
            {cancelled ? (
              <span className="text-ash">Cancelled</span>
            ) : (
              <>
                <span className="block h-[6px] w-[6px] rounded-full bg-local" aria-hidden />
                <span className="text-local">Reserved</span>
              </>
            )}
            {opened && <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">· opened</span>}
          </div>
          <h2 id={`${r.code}-title`} className="mt-1 font-mono text-[22px] tracking-[0.04em]">
            {r.code}
          </h2>
          <p className="mt-1 text-[13px] text-ash">
            {t.name} · {finishOpt?.label ?? r.finish} · held {when}
            {r.name || r.email ? <span> · for {r.name ?? r.email}</span> : null}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-[20px] font-medium">{formatPrice(r.total)}</div>
          <div className="text-[12px] text-ash">target total</div>
        </div>
      </div>

      <dl className="hairline mt-4 grid gap-x-6 gap-y-1.5 border-t pt-4 text-[13px] sm:grid-cols-2">
        <Pair k="Storage" v={storageOpt?.label ?? r.storage} />
        <Pair k="Cloud" v={cloudOpt?.label ?? r.cloud} />
        <Pair k="Add-ons" v={chosen.length ? chosen.map((a) => a.label).join(", ") : "None"} />
        <Pair k="Estimated delivery" v={estimatedDelivery[r.tier]} />
        <Pair k="Refundable deposit" v={`${formatPrice(r.deposit)}, when reservations open`} />
        {r.email && <Pair k="Email" v={r.email} />}
      </dl>

      {!cancelled && (
        <div className="mt-5">
          {confirming ? (
            <div role="group" aria-label={`Confirm cancelling ${r.code}`} className="rounded-[10px] bg-bone p-4 text-[13px]">
              <p>
                Cancel <span className="font-mono">{r.code}</span>? Your place is released. No deposit was taken, so
                there is nothing to refund.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={confirmCancel}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  className="btn btn-primary sm:!min-w-[180px] disabled:opacity-60"
                >
                  {busy ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    cancelRef.current?.focus();
                  }}
                  className="btn btn-secondary sm:!min-w-[120px] disabled:opacity-60"
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[13px] font-medium text-ash underline decoration-ink/20 underline-offset-4 hover:text-ink"
            >
              Cancel this reservation
            </button>
          )}
        </div>
      )}
      {cancelled && r.cancelledAt && (
        <p className="mt-4 text-[12px] text-ash">
          Cancelled {new Date(r.cancelledAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.
          Nothing was charged.
        </p>
      )}
    </article>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ash">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
