"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nav } from "@/lib/site";
import { Wordmark } from "./wordmark";
import { useSession } from "@/lib/auth";

type Theme = "light" | "dark" | "white";

/** Which nav item a path belongs to. Product pages all sit under "Core". */
function isActive(href: string, pathname: string) {
  if (href === "/core-plus") return /^\/core(-plus|-pro)?(\/|$)/.test(pathname);
  if (href === "/login") return pathname.startsWith("/login") || pathname.startsWith("/signup");
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Floating nav in the Tesla manner: no background, no border. Its colour
 * follows whichever themed section is currently under it.
 */
export function Nav() {
  const [theme, setTheme] = useState<Theme>("light");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? "/";
  const session = useSession();
  const right = nav.right.map((item) =>
    item.href === "/login" && session ? { label: "Dashboard", href: "/dashboard" } : item,
  );

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-theme]"),
    );
    if (sections.length === 0) return;

    const pick = () => {
      const probe = 28; // vertical centre of the nav bar
      let current: HTMLElement | null = null;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) {
          current = s;
          break;
        }
      }
      if (current) setTheme(current.dataset.theme as Theme);
      setScrolled(window.scrollY > 24);
    };

    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, []);

  const fg = theme === "dark" ? "text-bone" : "text-ink";
  const veil = !scrolled
    ? ""
    : theme === "dark"
      ? "bg-graphite/70 backdrop-blur-md"
      : theme === "white"
        ? "bg-white/70 backdrop-blur-md"
        : "bg-bone/70 backdrop-blur-md";

  const linkClass = (href: string) =>
    `rounded-btn px-4 py-1.5 text-[14px] font-medium transition-colors hover:bg-current/8 ${
      isActive(href, pathname) ? "bg-current/10" : ""
    }`;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 h-14 transition-colors duration-300 ${fg} ${veil}`}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Link href="/" aria-label="Woven home" className="flex items-center">
          <Wordmark className="h-[18px] w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {nav.center.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
              aria-current={isActive(item.href, pathname) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          {right.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
              aria-current={isActive(item.href, pathname) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-btn px-3 py-1.5 text-[14px] font-medium hover:bg-current/8 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          Menu
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-bone text-ink"
        >
          <div className="flex h-14 items-center justify-between px-6">
            <Wordmark className="h-[18px] w-auto" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-btn px-3 py-1.5 text-[14px] font-medium hover:bg-current/8"
            >
              Close
            </button>
          </div>
          <nav className="flex flex-col px-6 pt-6" aria-label="Mobile">
            {[...nav.center, ...right].map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between border-b border-ink/10 py-4 text-[17px] font-medium ${
                    active ? "text-ink" : "text-ink/80"
                  }`}
                >
                  {item.label}
                  {active && <span className="block h-[6px] w-[6px] rounded-full bg-amber" />}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
