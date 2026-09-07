"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Small mono line above the title, e.g. "Class H · strong auth". */
  kicker?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** Centre card (default) or a left-hand drawer for navigation. */
  variant?: "card" | "drawer";
  size?: "sm" | "md";
  /** Warm the kicker for approvals and class H actions. */
  tone?: "neutral" | "ask";
  className?: string;
};

/**
 * Accessible modal: role=dialog, aria-modal, labelled by its title, traps
 * Tab, closes on Escape and backdrop click, and returns focus to whatever
 * opened it. Renders nothing while closed so children mount fresh.
 */
export function Dialog({ open, onClose, kicker, title, children, variant = "card", size = "sm", tone = "neutral", className = "" }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Latest onClose without re-running the trap on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? el;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const f = focusables();
      if (f.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const a = document.activeElement;
      const idx = f.indexOf(a as HTMLElement);
      if (e.shiftKey && (idx <= 0 || !el.contains(a))) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && (idx === f.length - 1 || !el.contains(a))) {
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const drawer = variant === "drawer";
  const kickerTone = tone === "ask" ? "text-ask" : "text-ash";

  return (
    <div
      className={`dash-backdrop fixed inset-0 z-50 flex bg-[rgba(10,10,10,0.5)] ${drawer ? "justify-start" : "items-end justify-center p-4 sm:items-center"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          drawer
            ? `dash-drawer flex h-full w-[min(320px,86vw)] flex-col bg-bone p-5 text-ink shadow-[var(--shadow-sheet)] outline-none ${className}`
            : `dash-panel w-full ${size === "md" ? "max-w-[560px]" : "max-w-[440px]"} rounded-[20px] bg-white p-6 text-ink shadow-[var(--shadow-sheet)] outline-none ring-1 ring-ink/8 ${className}`
        }
      >
        {kicker && <div className={`font-mono text-[11px] uppercase tracking-[0.16em] ${kickerTone}`}>{kicker}</div>}
        <h2 id={titleId} className={`font-display font-medium tracking-[-0.02em] ${kicker ? "mt-1.5" : ""} ${drawer ? "text-[18px]" : "text-[22px]"}`}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Two buttons side by side under a dialog body. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-2">{children}</div>;
}
