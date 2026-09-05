import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

type Props = {
  id?: string;
  theme?: "light" | "dark" | "white";
  eyebrow?: string;
  title: string;
  body: ReactNode;
  /** Image on the right by default; flip to put it on the left. */
  flip?: boolean;
  image?: { src: string; alt: string; width: number; height: number; className?: string };
  children?: ReactNode;
  link?: { label: string; href: string };
  points?: string[];
};

/**
 * Split feature block: copy on one side, media on the other. On product
 * pages these alternate down the page the way Tesla's feature sections do.
 */
export function Feature({
  id,
  theme = "white",
  eyebrow,
  title,
  body,
  flip = false,
  image,
  children,
  link,
  points,
}: Props) {
  return (
    <section
      id={id}
      data-theme={theme}
      className="bg-[var(--section-bg)] text-[var(--section-fg)]"
    >
      <div
        className={`mx-auto grid min-h-[80svh] max-w-[1400px] items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-16 lg:px-10 ${
          flip ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal className="max-w-[460px] md:justify-self-center">
          {eyebrow && (
            <p className="text-[13px] font-medium text-[var(--section-muted)]">{eyebrow}</p>
          )}
          <h2 className="mt-2 font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
            {title}
          </h2>
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--section-muted)]">
            {body}
          </div>
          {points && (
            <ul className="mt-6 space-y-2.5 text-[14px]">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          {link && (
            <Link
              href={link.href}
              className="mt-7 inline-flex items-center gap-2 text-[14px] font-medium underline decoration-amber decoration-2 underline-offset-[6px] hover:decoration-amber-2"
            >
              {link.label}
            </Link>
          )}
        </Reveal>

        <Reveal delay={0.08} className="flex items-center justify-center">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 768px) 100vw, 50vw"
              className={image.className ?? "h-auto w-full max-w-[640px]"}
            />
          ) : (
            children
          )}
        </Reveal>
      </div>
    </section>
  );
}
