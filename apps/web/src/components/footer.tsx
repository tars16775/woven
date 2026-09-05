import Link from "next/link";
import { footerLinks } from "@/lib/site";

export function Footer() {
  return (
    <footer data-theme="light" className="bg-bone px-6 py-8 text-ash">
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-medium"
      >
        {footerLinks.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-ink">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mx-auto mt-6 max-w-[760px] text-center text-[11px] leading-relaxed text-ash-2">
        Prices, specifications and performance figures are engineering targets for a
        reference design and are not shipping specifications. Inside percentages describe
        supported requests and are measured, not promised. Voice, home and camera data never
        cross the Gate by default.
      </p>
      <p className="mx-auto mt-2 max-w-[760px] text-center text-[11px] leading-relaxed text-ash-2">
        This site sets no cookies and runs no analytics.
      </p>
    </footer>
  );
}
