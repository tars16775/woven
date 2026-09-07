"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { IconMore } from "./icons";
import type { Where } from "@/lib/dashboard/types";

/**
 * The dashboard's primitives (phase 2).
 *
 * Every room is built from these and nothing else. They draw only from the
 * tokens in globals.css, so a change to a radius or a surface lands
 * everywhere at once and no screen can quietly invent its own.
 */

/* ---------------------------------------------------------------- headings */

export function PageHeader({
  title,
  sub,
  action,
  kicker,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  /** A small mono line above the title: which room, or what state it is in. */
  kicker?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {kicker && <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">{kicker}</div>}
        <h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.02em] md:text-[34px]">{title}</h1>
        {sub && <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ash">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** A titled band inside a page, for grouping cards under one idea. */
export function Section({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-8 first:mt-0 ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">{title}</h2>
          {sub && <p className="mt-1 text-[13px] text-ash">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------- cards */

export function Card({
  title,
  action,
  children,
  className = "",
  dark = false,
  id,
  /** Removes the inner padding, for cards whose content manages its own edges. */
  flush = false,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  id?: string;
  flush?: boolean;
}) {
  const head = title || action;
  return (
    <section
      id={id}
      className={`rounded-[14px] ${
        dark ? "dash-lock bg-graphite text-bone ring-1 ring-white/8" : "bg-white text-ink shadow-[var(--shadow-card)] ring-1 ring-ink/5"
      } ${className}`}
    >
      {head && (
        <div className="flex items-center justify-between gap-4 px-5 pt-4">
          {title && <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${dark ? "text-ash-2" : "text-ash"}`}>{title}</h2>}
          {action}
        </div>
      )}
      {flush ? children : <div className={head ? "px-5 pb-5 pt-3" : "p-5"}>{children}</div>}
    </section>
  );
}

/** One number that matters, optionally a link into the room that owns it. */
export function Stat({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  /** Colours the number when it is the point of the card. */
  tone?: "good" | "warn";
}) {
  const colour = tone === "good" ? "text-local" : tone === "warn" ? "text-ask" : "";
  const body = (
    <>
      <div className="text-[13px] text-ash">{label}</div>
      <div className={`tnum mt-1 font-display text-[28px] font-medium leading-none tracking-[-0.02em] ${colour}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-ash">{sub}</div>}
    </>
  );
  const cls = "block rounded-[14px] bg-white px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-ink/5";
  return href ? (
    <Link href={href} className={`${cls} tap hover:ring-ink/15`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* -------------------------------------------------------------- where + tone */

/* Where something ran. Data keeps the wire values; people read the house words. */
export const whereLabel: Record<Where, string> = {
  local: "Inside",
  device: "Device",
  policy: "Policy",
  cloud: "Gate",
};

/** Longer form for receipts: "Inside, on the box". */
export const whereRan: Record<Where, string> = {
  local: "Inside, on the box",
  device: "On the device",
  policy: "Policy engine, on the box",
  cloud: "Across the Gate",
};

const whereStyle: Record<Where, string> = {
  local: "bg-local-bg text-local",
  device: "bg-local-bg text-local",
  policy: "bg-chassis text-ink/70",
  cloud: "bg-ask-bg text-ask",
};

export function WherePill({ where }: { where: Where }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] ${whereStyle[where]}`}>
      <span className={`block h-[5px] w-[5px] rounded-full ${where === "cloud" ? "bg-ask" : where === "policy" ? "bg-ink/40" : "bg-local"}`} />
      {whereLabel[where]}
    </span>
  );
}

export type Tone = "neutral" | "good" | "warn" | "dark";

const toneStyle: Record<Tone, string> = {
  neutral: "bg-chassis text-ink/70",
  good: "bg-local-bg text-local",
  warn: "bg-ask-bg text-ask",
  dark: "bg-ink text-bone",
};

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${toneStyle[tone]} ${className}`}>{children}</span>;
}

/** A pill with a lit dot: for states that are live rather than labels. */
export function StatusDot({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const dot = tone === "good" ? "bg-local" : tone === "warn" ? "bg-ask" : tone === "dark" ? "bg-bone" : "bg-ink/40";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${toneStyle[tone]}`}>
      <span className={`block h-[6px] w-[6px] shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ meters */

export function Meter({
  value,
  max,
  className = "",
  tone = "amber",
  label,
}: {
  value: number;
  max: number;
  className?: string;
  tone?: "amber" | "good" | "warn";
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = tone === "good" ? "bg-local" : tone === "warn" ? "bg-ask" : "bg-amber";
  return (
    <div
      className={`h-[6px] w-full overflow-hidden rounded-full bg-chassis ${className}`}
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Small mono caption used under names and on tiles. 11px floor. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-[0.12em] text-ash ${className}`}>{children}</div>;
}

/* ----------------------------------------------------------------- buttons */

export type ButtonKind = "outline" | "soft" | "primary" | "quiet" | "danger";

const kinds: Record<ButtonKind, string> = {
  outline: "bg-white text-ink ring-1 ring-ink/8 hover:ring-ink/20",
  soft: "bg-bone text-ink hover:bg-chassis",
  primary: "bg-amber text-[#1a1a1a] hover:bg-amber-2",
  quiet: "text-ash hover:bg-bone hover:text-ink",
  danger: "bg-[#c0392b] text-white hover:bg-[#a93226]",
};

/** The dashboard's small action button. Every one does something. */
export function Button({
  kind = "outline",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return (
    <button
      type={type}
      className={`tap inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${kinds[kind]} ${className}`}
      {...rest}
    />
  );
}

/** A button-shaped link. Same metrics, so they can sit next to each other. */
export function ButtonLink({
  kind = "outline",
  className = "",
  href,
  children,
  ...rest
}: { kind?: ButtonKind; className?: string; href: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={`tap inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium ${kinds[kind]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- forms */

export const inputClass =
  "tap w-full rounded-[8px] bg-bone px-3 py-2 text-[14px] text-ink outline-none ring-1 ring-ink/8 placeholder:text-ash focus:ring-2 focus:ring-amber";

/** Labelled control. Wraps its child in a label, so the hint reads with it. */
export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
}) {
  return (
    <label className="block text-[13px]">
      <span className="font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {error ? (
        <span role="alert" className="mt-1 block text-[12px] text-[#a13a2a]">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-[12px] text-ash">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} resize-y ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/**
 * On or off, and honest about it: a switch that is waiting on the box reads
 * as busy rather than pretending the change already happened.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={`tap relative block h-6 w-11 shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-amber" : "bg-chassis-2"}`}
    >
      <span
        className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white shadow-[var(--shadow-card)] transition-[left] duration-200 ${
          checked ? "left-[26px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

/** Tabs that are really a filter: one row of pills, one selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`tap rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              on ? "bg-ink text-bone" : "bg-white text-ink/80 ring-1 ring-ink/8 hover:ring-ink/20"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- people, lists */

/** A person's initial. The dashboard never invents an avatar image. */
export function Avatar({ name, size = 32, tone = "dark" }: { name: string; size?: number; tone?: "dark" | "soft" }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-medium ${tone === "dark" ? "bg-ink text-bone" : "bg-chassis text-ink/70"}`}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/** One row in a list card: something on the left, its state on the right. */
export function Row({
  title,
  detail,
  lead,
  trail,
  href,
  onClick,
}: {
  title: ReactNode;
  detail?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-[12px] text-ash">{detail}</span>}
      </span>
      {trail && <span className="shrink-0">{trail}</span>}
    </>
  );
  const cls = "flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0";
  if (href) {
    return (
      <Link href={href} className={`${cls} tap -mx-2 rounded-[8px] px-2 hover:bg-bone`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} tap -mx-2 rounded-[8px] px-2 hover:bg-bone`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** A divided stack of rows. */
export function Rows({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-ink/6 ${className}`}>{children}</div>;
}

/* ------------------------------------------------------- empty and loading */

/**
 * What a room says when it holds nothing. Never an apology and never a
 * shrug: it says what will be here, and offers the one thing that fills it.
 */
export function Empty({
  title,
  body,
  action,
  icon,
  className = "",
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-[14px] bg-white px-6 py-12 text-center shadow-[var(--shadow-card)] ring-1 ring-ink/5 ${className}`}>
      {icon && <div className="mb-4 text-ash">{icon}</div>}
      <h3 className="font-display text-[20px] font-medium tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-ash">{body}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** A block that holds the shape of what is coming. */
export function Skeleton({ className = "", rounded = "md" }: { className?: string; rounded?: "sm" | "md" | "lg" | "full" }) {
  const r = rounded === "sm" ? "rounded-[8px]" : rounded === "lg" ? "rounded-[14px]" : rounded === "full" ? "rounded-full" : "rounded-[12px]";
  return <div aria-hidden className={`skeleton ${r} bg-chassis ${className}`} />;
}

/** Several skeleton rows, matching the metrics of <Rows>. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-ink/6" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Skeleton className="h-8 w-8" rounded="full" />
          <div className="flex-1">
            <Skeleton className="h-[13px] w-[42%]" rounded="sm" />
            <Skeleton className="mt-2 h-[11px] w-[26%]" rounded="sm" />
          </div>
          <Skeleton className="h-[18px] w-16" rounded="full" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ notes */

/** An inline note. Never an alert unless something actually went wrong. */
export function Note({
  tone = "neutral",
  children,
  className = "",
  role,
}: {
  tone?: "neutral" | "good" | "warn";
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const t =
    tone === "good" ? "bg-local-bg text-local ring-local/20" : tone === "warn" ? "bg-ask-bg text-ask ring-amber/25" : "bg-bone text-ink/80 ring-ink/8";
  return (
    <div role={role} className={`rounded-[12px] px-4 py-3 text-[13px] leading-relaxed ring-1 ${t} ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- menu */

/**
 * A small overflow menu, for rows that have more actions than fit.
 *
 * Deliberately plain: a popover positioned by the browser rather than by a
 * measuring library, closed by Escape, a click outside, or choosing
 * something. Five text buttons in a row is a wall; one is a door.
 */
export function Menu({
  label,
  items,
  align = "right",
}: {
  label: string;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tap rounded-[8px] p-1.5 text-ash hover:bg-bone hover:text-ink"
      >
        <IconMore size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className={`dash-panel absolute z-20 mt-1 min-w-[168px] overflow-hidden rounded-[12px] bg-white py-1 shadow-[var(--shadow-pop)] ring-1 ring-ink/8 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`tap block w-full px-3.5 py-2 text-left text-[13.5px] hover:bg-bone ${it.danger ? "text-[#a13a2a]" : "text-ink"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
