import Link from "next/link";
import { AvailabilityTag } from "./claim";
import { specGroups } from "@/lib/specs";
import type { TierId } from "@/lib/site";

export function SpecTable({ tier }: { tier: TierId }) {
  return (
    <section id="specs" data-theme="light" className="bg-bone text-ink">
      <div className="mx-auto max-w-[1100px] px-6 py-20 lg:px-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-[32px] font-medium tracking-[-0.02em] md:text-[38px]">Specs</h2>
          <AvailabilityTag status="target" />
        </div>
        <p className="mt-2 max-w-[620px] text-[14px] text-ash">
          Targets for a reference design. No chassis has been built, so none of these figures has
          been measured in one; parts are chosen but not certified. When there is hardware, this
          table becomes measurements and says so.{" "}
          <Link href="/status" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            What is real
          </Link>
        </p>
        <div className="mt-12 grid gap-x-16 gap-y-12 md:grid-cols-2">
          {specGroups.map((g) => (
            <div key={g.title}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
                {g.title}
              </h3>
              <dl className="mt-3">
                {g.rows.map((r) => (
                  <div
                    key={r.label}
                    className="hairline flex items-baseline justify-between gap-6 border-t py-3 text-[14px]"
                  >
                    <dt className="text-ash">{r.label}</dt>
                    <dd className="text-right font-medium">{r.values[tier]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
