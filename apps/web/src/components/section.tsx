import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";
import { ScrollCue } from "./scroll-cue";

type Cta = { label: string; href: string };

type Props = {
  id?: string;
  theme?: "light" | "dark" | "white";
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  primary?: Cta;
  secondary?: Cta;
  children?: ReactNode;
  /** Vertical alignment of the media area. */
  align?: "center" | "end";
  className?: string;
  titleAs?: "h1" | "h2";
  /** Extra classes for the title, e.g. a smaller size for a long headline. */
  titleClassName?: string;
  /** Anchor of the next section; shows the small chevron under the actions. */
  cue?: string;
};

/**
 * One full-height slide in the Tesla manner: copy at the top, product in the
 * middle, actions at the bottom. The section owns its theme so the floating
 * nav can follow it.
 */
export function Section({
  id,
  theme = "light",
  eyebrow,
  title,
  subtitle,
  primary,
  secondary,
  children,
  align = "center",
  className = "",
  titleAs = "h2",
  titleClassName = "",
  cue,
}: Props) {
  const Title = titleAs;
  return (
    <section
      id={id}
      data-theme={theme}
      className={`relative flex min-h-svh flex-col bg-[var(--section-bg)] text-[var(--section-fg)] ${className}`}
    >
      <Reveal className="px-6 pt-24 text-center md:pt-28">
        {eyebrow && (
          <p className="text-[13px] font-medium tracking-[0.01em] text-[var(--section-muted)]">
            {eyebrow}
          </p>
        )}
        <Title
          className={`mt-2 font-display text-[32px] font-medium leading-[1.02] tracking-[-0.02em] md:text-[44px] md:leading-[1.05] ${titleClassName}`}
        >
          {title}
        </Title>
        {subtitle && (
          <p className="mx-auto mt-2 max-w-[560px] text-[14px] leading-relaxed text-[var(--section-muted)] md:text-[15px]">
            {subtitle}
          </p>
        )}
      </Reveal>

      <div
        className={`relative flex flex-1 ${
          align === "end" ? "items-end" : "items-center"
        } justify-center px-6 py-6`}
      >
        {children}
      </div>

      {(primary || secondary) && (
        <div
          className={`flex flex-col items-center justify-center gap-3 px-6 sm:flex-row sm:gap-4 ${
            cue ? "pb-16 md:pb-20" : "pb-12 md:pb-14"
          }`}
        >
          {primary && (
            <Link href={primary.href} className="btn btn-primary">
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="btn btn-secondary">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
      {cue && <ScrollCue href={cue} />}
    </section>
  );
}
