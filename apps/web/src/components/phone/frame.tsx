import type { CSSProperties, ReactNode } from "react";

/**
 * A phone, rendered rather than photographed, so every app screen on the
 * site is crisp at any size and matches the dashboard exactly. Content is
 * laid out at 360 × 780 logical pixels and scaled to the requested width.
 */
export function PhoneFrame({
  width = 300,
  children,
  className = "",
  dark = false,
  label,
}: {
  width?: number;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  /** What the screen shows, for assistive technology. */
  label: string;
}) {
  const s = width / 360;
  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width, height: 780 * s }}
      role="img"
      aria-label={label}
    >
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: 360, height: 780, transform: `scale(${s})` } as CSSProperties}
      >
        {/* Body */}
        <div
          className="absolute inset-0 rounded-[54px] bg-[#111]"
          style={{ boxShadow: "0 40px 90px -30px rgba(20,20,20,0.55), inset 0 0 0 2px rgba(255,255,255,0.08)" }}
        />
        {/* Screen */}
        <div
          className={`absolute inset-[10px] overflow-hidden rounded-[44px] ${dark ? "bg-graphite text-bone" : "bg-bone text-ink"}`}
        >
          {/* Status bar */}
          <div className="flex items-center justify-between px-8 pt-4 text-[13px] font-semibold">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <span className="block h-[10px] w-[16px] rounded-[2px] border border-current" />
            </span>
          </div>
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-[12px] h-[30px] w-[108px] -translate-x-1/2 rounded-full bg-[#111]" />
          <div className="h-[calc(100%-44px)] px-5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function TabBar({ active, dark = false }: { active: string; dark?: boolean }) {
  const tabs = ["Home", "Ask", "Files", "Photos", "Privacy"];
  return (
    <div className={`absolute inset-x-0 bottom-0 flex items-end justify-around px-6 pb-6 pt-3 ${dark ? "bg-graphite" : "bg-bone"}`}>
      {tabs.map((t) => {
        const on = t === active;
        return (
          <div key={t} className="flex flex-col items-center gap-1">
            <span className={`block h-[18px] w-[18px] rounded-[5px] ${on ? "bg-amber" : dark ? "bg-white/15" : "bg-ink/15"}`} />
            <span className={`text-[11px] ${on ? "font-medium" : dark ? "text-ash-2" : "text-ash"}`}>{t}</span>
          </div>
        );
      })}
      <span className="absolute bottom-2 left-1/2 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-current opacity-80" />
    </div>
  );
}
