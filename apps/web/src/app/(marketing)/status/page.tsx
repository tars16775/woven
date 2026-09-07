import type { Metadata } from "next";
import Link from "next/link";
import { AvailabilityTag } from "@/components/claim";
import { availabilityBlurb, claimsByStatus, type Availability } from "@/lib/claims";

export const metadata: Metadata = {
  title: "What is real",
  description:
    "Everything Woven claims, sorted into what runs today, what waits on hardware, and what is still only a target. Written by the people building it, updated with the software.",
};

const order: Availability[] = ["now", "box", "target"];

const heading: Record<Availability, string> = {
  now: "Running today",
  box: "Waiting on the box",
  target: "Numbers we are aiming at",
};

/**
 * The page a company selling an unbuilt box owes its visitors. Rendered from
 * `src/lib/claims.ts`, the same file the footnotes come from, so this page
 * and the marketing copy cannot disagree.
 */
export default function StatusPage() {
  const counts = Object.fromEntries(order.map((s) => [s, claimsByStatus(s).length])) as Record<Availability, number>;

  return (
    <>
      <section data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[900px] px-6 pb-14 pt-32 lg:px-10 md:pt-40">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ash">Written by the people building it</p>
          <h1 className="mt-4 font-display text-[40px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[56px]">What is real, and what is not.</h1>
          <p className="mt-5 max-w-[620px] text-[16px] leading-relaxed text-ash md:text-[17px]">
            Woven is software that runs today and a box that does not exist yet. Selling the second by describing it in the present tense is the ordinary way to do this, and we would rather not. Everything this site claims is below, in one of three piles.
          </p>
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {order.map((s) => (
              <div key={s} className="rounded-[12px] bg-white p-5 ring-1 ring-ink/5">
                <dt>
                  <AvailabilityTag status={s} />
                </dt>
                <dd className="mt-3 font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{counts[s]}</dd>
                <dd className="mt-1.5 text-[13px] leading-relaxed text-ash">{availabilityBlurb[s]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[13px] text-ash">
            The software is open to inspection:{" "}
            <Link href="/mac" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              run a Core on a Mac
            </Link>{" "}
            and check any line in the first pile yourself.
          </p>
        </div>
      </section>

      {order.map((status, i) => (
        <section key={status} data-theme={i % 2 === 0 ? "white" : "light"} className={i % 2 === 0 ? "bg-white text-ink" : "bg-bone text-ink"}>
          <div className="mx-auto max-w-[900px] px-6 py-16 lg:px-10">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[34px]">{heading[status]}</h2>
              <AvailabilityTag status={status} />
            </div>
            <p className="mt-2 max-w-[600px] text-[14px] text-ash">{availabilityBlurb[status]}</p>
            <ul className="mt-8 divide-y divide-ink/8 border-t border-ink/8">
              {claimsByStatus(status).map(({ id, claim }) => (
                <li key={id} id={`claim-${id}`} className="scroll-mt-24 py-5">
                  <h3 className="text-[16px] font-medium leading-snug">{claim.claim}</h3>
                  <p className="mt-1.5 max-w-[680px] text-[13.5px] leading-relaxed text-ash">{claim.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section data-theme="dark" className="bg-graphite text-bone">
        <div className="mx-auto max-w-[900px] px-6 py-16 lg:px-10">
          <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] md:text-[32px]">How this page stays honest</h2>
          <ul className="mt-6 grid gap-4 text-[14px] leading-relaxed text-ash-2 md:grid-cols-2">
            <li>Every claim here is one row in a file the site renders from. Marketing copy cannot make a measurable statement without adding a row.</li>
            <li>A row moves out of the first pile only when the software does the thing and a test proves it. The tests run on every change.</li>
            <li>Figures drawn on the phone and television screens elsewhere on this site are illustrations. Where one appears, the page says so.</li>
            <li>When the box exists, the middle pile moves up one by one, and this page will show the date each one moved.</li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/mac" className="btn btn-primary">
              Run it on your Mac
            </Link>
            <Link href="/founding-homes" className="btn btn-secondary">
              Founding Homes
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
