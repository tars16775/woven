import type { ReactNode } from "react";
import { Reveal } from "./reveal";

/** Header and body for text-led pages: support, developers, legal, press. */
export function PageFrame({
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <>
      <section data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[1100px] px-6 pb-14 pt-32 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash">{eyebrow}</p>
            <h1 className="mt-2 max-w-[760px] font-display text-[40px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[52px]">
              {title}
            </h1>
            {intro && (
              <div className="mt-5 max-w-[620px] text-[16px] leading-relaxed text-ash">{intro}</div>
            )}
          </Reveal>
        </div>
      </section>
      <section data-theme="white" className="bg-white text-ink">
        <div className="mx-auto grid max-w-[1100px] gap-12 px-6 py-16 lg:grid-cols-[1fr_280px] lg:px-10">
          <div className="min-w-0">{children}</div>
          {aside && <aside className="lg:pt-2">{aside}</aside>}
        </div>
      </section>
    </>
  );
}

export function Block({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="hairline border-t py-10 first:border-t-0 first:pt-0">
      <h2 className="font-display text-[26px] font-medium tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink/85 [&_a]:underline [&_a]:decoration-amber [&_a]:decoration-2 [&_a]:underline-offset-4 [&_p]:max-w-[640px]">
        {children}
      </div>
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre tabIndex={0} className="overflow-x-auto rounded-[12px] bg-graphite px-5 py-4 font-mono text-[12.5px] leading-relaxed text-bone focus:outline-none focus-visible:ring-2 focus-visible:ring-amber">
      <code>{children}</code>
    </pre>
  );
}
