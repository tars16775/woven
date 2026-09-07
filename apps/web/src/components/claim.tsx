import Link from "next/link";
import { availabilityLabel, claims, type Availability, type ClaimId } from "@/lib/claims";

/**
 * The site's honesty furniture: a superscript marker beside a claim, the
 * numbered notes at the foot of the page, and the small tag that says
 * whether a thing runs today or waits on hardware.
 *
 * A page declares the notes it uses, in the order they appear, and both the
 * markers and the list read from that one array, so a number can never point
 * at the wrong note.
 */
export function Fn({ notes, id }: { notes: readonly ClaimId[]; id: ClaimId }) {
  const n = notes.indexOf(id) + 1;
  if (n === 0) return null;
  return (
    <sup className="ml-[1px] align-super text-[0.62em] font-normal leading-none">
      <Link href={`#fn-${id}`} className="text-current no-underline opacity-60 transition-opacity hover:opacity-100" aria-label={`Footnote ${n}: ${claims[id].claim}`}>
        {n}
      </Link>
    </sup>
  );
}

export function Footnotes({ notes, className = "" }: { notes: readonly ClaimId[]; className?: string }) {
  if (notes.length === 0) return null;
  return (
    <section data-theme="light" className={`bg-bone text-ink ${className}`}>
      <div className="mx-auto max-w-[900px] px-6 py-14 lg:px-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash">What stands behind this page</h2>
        <ol className="mt-5 space-y-3">
          {notes.map((id, i) => {
            const c = claims[id];
            return (
              <li key={id} id={`fn-${id}`} className="grid scroll-mt-24 grid-cols-[1.4rem_1fr] gap-2 text-[12.5px] leading-relaxed text-ash">
                <span className="font-mono text-[11px] text-ash/70">{i + 1}</span>
                <span>
                  <AvailabilityTag status={c.status} className="mr-2 align-[1px]" />
                  {c.note}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-[12.5px] text-ash">
          Every claim on this site is listed with what stands behind it on the{" "}
          <Link href="/status" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            what is real page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

const tone: Record<Availability, string> = {
  now: "bg-local-bg text-local",
  box: "bg-chassis text-ash",
  target: "bg-ask-bg text-ask",
};

/** "Available now", "With the box", "Engineering target". */
export function AvailabilityTag({ status, className = "" }: { status: Availability; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em] ${tone[status]} ${className}`}>
      {availabilityLabel[status]}
    </span>
  );
}

/** The same tag, taken from a claim so a section cannot drift from its evidence. */
export function ClaimTag({ id, className = "" }: { id: ClaimId; className?: string }) {
  return <AvailabilityTag status={claims[id].status} className={className} />;
}
