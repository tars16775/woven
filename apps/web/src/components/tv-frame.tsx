const tones = ["#8a7d63", "#5c6b5a", "#9a8a72", "#4d5563", "#a39781", "#6d6a5a", "#7a6d5c", "#575e52"];

/**
 * Woven on the television. A 16:9 panel with the home screen: what is
 * playing, the household's photos, the cameras, and a place to ask.
 */
export function TVFrame({
  className = "",
  label = "Woven on a television: the living room home screen with this week's photos, four live camera tiles, a continue-watching rail and a place to ask Tandem.",
}: {
  className?: string;
  /** What the screen shows, for assistive technology. */
  label?: string;
}) {
  return (
    <div className={`@container relative w-full ${className}`} role="img" aria-label={label}>
      <div
        aria-hidden="true"
        className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-graphite text-bone ring-1 ring-white/10"
        style={{ boxShadow: "0 60px 120px -40px rgba(0,0,0,0.8), inset 0 0 0 6px #0b0b0b" }}
      >
        {/* Backdrop photo */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, #3b3a33 0%, #171716 55%, #101010 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,20,20,0) 40%, rgba(20,20,20,0.9) 100%)" }} />

        {/* Top bar */}
        <div className="absolute inset-x-[4%] top-[5%] flex items-center justify-between text-[clamp(8px,1.6cqw,14px)]">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold tracking-[-0.02em]">woven</span>
            <span className="text-ash-2">Living room</span>
          </div>
          <div className="flex items-center gap-2 font-mono uppercase tracking-[0.16em] text-ash-2">
            <span className="orb" style={{ ["--orb" as string]: "clamp(5px,0.9cqw,8px)" }} />
            inside · 21:42
          </div>
        </div>

        {/* Hero tile copy */}
        <div className="absolute left-[4%] top-[20%] max-w-[52%] @sm:max-w-[48%]">
          <div className="font-mono text-[clamp(7px,1.2cqw,11px)] uppercase tracking-[0.18em] text-amber-2">Photos · this week</div>
          <div className="mt-1 font-display text-[clamp(14px,4cqw,40px)] font-medium leading-[1.05] tracking-[-0.02em]">Lake trip, July</div>
          <div className="mt-1 hidden text-[clamp(8px,1.6cqw,14px)] text-ash-2 @sm:block">38 photos · Maya in 21 of them · indexed inside</div>
          <div className="mt-3 flex gap-2 text-[clamp(7px,1.4cqw,13px)] font-medium">
            <span className="rounded-[4px] bg-bone px-3 py-1.5 text-ink">Play</span>
            <span className="hidden rounded-[4px] bg-white/10 px-3 py-1.5 @sm:inline-block">Ask about this</span>
          </div>
        </div>

        {/* Rails */}
        <div className="absolute inset-x-[4%] bottom-[5%]">
          <div className="text-[clamp(7px,1.4cqw,13px)] font-medium">Cameras · live</div>
          <div className="mt-1.5 grid grid-cols-4 gap-[2%]">
            {["Front door", "Back garden", "Driveway", "Hallway"].map((c, i) => (
              <div key={c} className="relative aspect-video overflow-hidden rounded-[4px]" style={{ background: `radial-gradient(ellipse at 50% 60%, ${tones[i]}55 0%, #141414 80%)` }}>
                <span className="absolute left-[6%] top-[8%] flex items-center gap-1 font-mono text-[clamp(5px,1cqw,9px)] uppercase tracking-[0.12em] text-bone/80">
                  <span className="block h-[4px] w-[4px] rounded-full bg-[#d64545]" /> live
                </span>
                <span className="absolute bottom-[8%] left-[6%] text-[clamp(6px,1.3cqw,12px)] font-medium">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-[2%] flex items-center gap-2 rounded-full bg-white/8 px-3 py-[0.6%] text-[clamp(7px,1.4cqw,13px)] text-ash-2">
            <span className="orb" style={{ ["--orb" as string]: "clamp(5px,1cqw,9px)" }} />
            Ask Tandem, or say &ldquo;Tandem&rdquo;
          </div>
        </div>

        {/* Movies rail, faint on the right */}
        <div className="absolute right-[4%] top-[20%] hidden w-[40%] @md:block">
          <div className="text-[clamp(7px,1.4cqw,13px)] font-medium">Continue watching</div>
          <div className="mt-1.5 grid grid-cols-3 gap-[3%]">
            {tones.slice(0, 3).map((t, i) => (
              <div key={i} className="aspect-[2/3] rounded-[4px]" style={{ background: `linear-gradient(160deg, ${t} 0%, #1a1a19 100%)` }} />
            ))}
          </div>
        </div>
      </div>
      {/* Stand */}
      <div aria-hidden="true" className="mx-auto mt-[1.5%] h-[1.2%] w-[22%] rounded-full bg-[#0b0b0b]" />
    </div>
  );
}
