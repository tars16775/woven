"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Slim bar that appears once the hero has scrolled away, the way Tesla's
 * product pages keep the order action within reach.
 */
export function StickyBar({
  name,
  price,
  href,
  label = "Reserve",
}: {
  name: string;
  price: string;
  href: string;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.8;
      const nearEnd =
        window.scrollY + window.innerHeight >
        document.documentElement.scrollHeight - window.innerHeight * 1.1;
      setShow(pastHero && !nearEnd);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto mb-[calc(1rem+env(safe-area-inset-bottom))] flex w-[calc(100%-2rem)] max-w-[720px] items-center justify-between gap-4 rounded-[10px] bg-graphite/92 px-5 py-3 text-bone shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <div className="min-w-0">
          <div className="whitespace-nowrap font-display text-[15px] font-medium">{name}</div>
          <div className="text-[12px] text-ash-2">From {price}</div>
        </div>
        <Link href={href} className="btn btn-primary min-w-0 w-auto! shrink-0 px-6" tabIndex={show ? 0 : -1}>
          {label}
        </Link>
      </div>
    </div>
  );
}
