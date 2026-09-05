import Link from "next/link";
import type { Tier } from "@/lib/site";

/** Tesla-style hero stat row: big value, small label, CTA at the end. */
export function SpecStrip({ tier, cta }: { tier: Tier; cta: { label: string; href: string } }) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-6 px-6 pb-10 md:flex-row md:items-end md:justify-between md:pb-14">
      <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-5 md:flex md:w-auto md:gap-x-14">
        {tier.stats.map((s) => (
          <div key={s.label} className="flex flex-col">
            <dd className="font-display text-[28px] font-medium leading-none tracking-[-0.02em] md:text-[32px]">
              {s.value}
              {s.note && (
                <span className="ml-1 align-baseline text-[13px] font-normal tracking-normal text-[var(--section-muted)]">
                  {s.note}
                </span>
              )}
            </dd>
            <dt className="mt-1.5 text-[12px] text-[var(--section-muted)]">{s.label}</dt>
          </div>
        ))}
      </dl>
      <Link href={cta.href} className="btn btn-primary md:min-w-[200px]">
        {cta.label}
      </Link>
    </div>
  );
}
