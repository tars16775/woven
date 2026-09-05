import type { ReactNode } from "react";

/**
 * The box's own display: a 5-inch, 5:3 touchscreen set into the front of
 * the chassis. Rendered rather than photographed so every screen on the site
 * is crisp at any size. Content sizes with cqw units so the frame can sit
 * in any column, from a phone viewport to a 640px feature slot.
 */
export function ScreenFrame({
  label,
  header = "WOVEN CORE+",
  status = "Inside · 21:42",
  children,
  className = "",
}: {
  /** What the screen shows, for assistive technology. */
  label: string;
  header?: string;
  status?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`@container relative w-full ${className}`} role="img" aria-label={label}>
      <div
        aria-hidden="true"
        className="relative aspect-[5/3] w-full overflow-hidden rounded-[clamp(10px,2.4cqw,18px)] bg-graphite text-bone ring-1 ring-white/10"
        style={{
          boxShadow: "0 50px 100px -40px rgba(0,0,0,0.75), inset 0 0 0 clamp(4px,1cqw,7px) #0b0b0b",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 42%, #2a2618 0%, #161615 45%, #101010 100%)" }}
        />
        {/* Header */}
        <div className="absolute inset-x-[4.5%] top-[6.5%] flex items-center justify-between font-mono text-[clamp(8px,1.7cqw,13px)] uppercase tracking-[0.2em] text-ash-2">
          <span className="text-bone/80">{header}</span>
          <span className="normal-case tracking-[0.02em]">{status}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
