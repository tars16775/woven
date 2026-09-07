import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Where } from "@/lib/dashboard/types";

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.02em] md:text-[34px]">
          {title}
        </h1>
        {sub && <p className="mt-2 text-[14px] text-ash">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  dark = false,
  id,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-[14px] ${
        dark ? "dash-lock bg-graphite text-bone ring-1 ring-white/8" : "bg-white text-ink ring-1 ring-ink/5"
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-5 pt-4">
          {title && <h2 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${dark ? "text-ash-2" : "text-ash"}`}>{title}</h2>}
          {action}
        </div>
      )}
      <div className={title || action ? "px-5 pb-5 pt-3" : "p-5"}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[13px] text-ash">{label}</div>
      <div className="mt-1 font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-ash">{sub}</div>}
    </>
  );
  const cls = "block rounded-[14px] bg-white px-5 py-4 ring-1 ring-ink/5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:ring-ink/15`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

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

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "dark" }) {
  const t =
    tone === "good"
      ? "bg-local-bg text-local"
      : tone === "warn"
        ? "bg-ask-bg text-ask"
        : tone === "dark"
          ? "bg-ink text-bone"
          : "bg-chassis text-ink/70";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${t}`}>{children}</span>;
}

export function Meter({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-[6px] w-full overflow-hidden rounded-full bg-chassis ${className}`}>
      <div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Small mono caption used under names and on tiles. 11px floor. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-[0.12em] text-ash ${className}`}>{children}</div>;
}

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
      className={`inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${kinds[kind]} ${className}`}
      {...rest}
    />
  );
}

/** Labelled text input for dialogs. */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-[13px]">
      <span className="font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-[12px] text-ash">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[8px] bg-bone px-3 py-2 text-[14px] text-ink outline-none ring-1 ring-ink/8 placeholder:text-ash focus:ring-2 focus:ring-amber";
