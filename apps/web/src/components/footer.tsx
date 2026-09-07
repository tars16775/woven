import Link from "next/link";
import { footerGroups } from "@/lib/site";
import { Wordmark } from "./wordmark";

/**
 * The directory at the bottom of the shop: every page in four columns, then
 * the line that says what on this site is a target rather than a fact.
 */
export function Footer() {
  return (
    <footer data-theme="light" className="bg-bone text-ash">
      <div className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10">
        <nav aria-label="Footer" className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {footerGroups.map((g) => (
            <div key={g.title}>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash/80">{g.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13.5px] font-medium text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-14 border-t border-ink/8 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" aria-label="Woven home" className="text-ink">
              <Wordmark className="h-[16px]" />
            </Link>
            <p className="text-[12px]">Woven © 2026</p>
          </div>
          <p className="mt-5 max-w-[760px] text-[11.5px] leading-relaxed">
            The box is not built. Prices, dates, specifications and performance figures on this site
            are engineering targets for a reference design, not shipping specifications, and the
            figures drawn on the phone and television screens are illustrations rather than
            measurements. What the software does today, and what it does not,{" "}
            <Link href="/status" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              is listed claim by claim
            </Link>
            .
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed">This site sets no cookies and runs no analytics.</p>
        </div>
      </div>
    </footer>
  );
}
