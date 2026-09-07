"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { label: string; href: string };

/**
 * The product bar: once the hero has scrolled away, the name of the thing you
 * are reading about stays at the top with the places you might jump to and the
 * price. It sits under the site nav rather than over it, so both stay legible.
 */
export function ProductNav({ name, price, items, cta }: { name: string; price: string; items: Item[]; cta: Item }) {
  const [show, setShow] = useState(false);
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const targets = items.map((i) => document.querySelector<HTMLElement>(i.href)).filter((el): el is HTMLElement => !!el);
    const onScroll = () => {
      setShow(window.scrollY > window.innerHeight * 0.75);
      // The section whose top has most recently passed under the bars.
      let current: string | null = null;
      for (const el of targets) {
        if (el.getBoundingClientRect().top <= 140) current = `#${el.id}`;
      }
      setHere(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 top-14 z-40 border-b border-ink/8 bg-bone/80 backdrop-blur-md transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <nav aria-label={`${name} sections`} className="mx-auto flex h-12 max-w-[1400px] items-center gap-4 px-6 lg:px-10">
        <span className="shrink-0 font-display text-[15px] font-medium tracking-[-0.01em] text-ink">{name}</span>
        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((i) => (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                tabIndex={show ? 0 : -1}
                aria-current={here === i.href ? "true" : undefined}
                className={`rounded-btn px-2.5 py-1 transition-colors hover:text-ink ${here === i.href ? "font-medium text-ink" : "text-ash"}`}
              >
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <span className="hidden shrink-0 text-[13px] text-ash sm:block">From {price}</span>
        <Link href={cta.href} tabIndex={show ? 0 : -1} className="btn btn-primary h-8! w-auto! min-w-0! shrink-0 px-4 text-[13px]!">
          {cta.label}
        </Link>
      </nav>
    </div>
  );
}
