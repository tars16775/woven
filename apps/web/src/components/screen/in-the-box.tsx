/**
 * What's in the box, drawn with CSS instead of photographed. Every item is a
 * card with a small diagram built from shapes and the palette, so the sheet
 * matches the rest of the site and never needs re-rendering.
 */

function Art({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-white ring-1 ring-ink/5" aria-hidden="true">
      {children}
    </div>
  );
}

function Chassis({ name }: { name: string }) {
  return (
    <Art>
      <div className="absolute left-1/2 top-1/2 h-[64%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[14%] bg-chassis shadow-[inset_0_-6px_12px_rgba(20,20,20,0.08),0_14px_24px_-14px_rgba(20,20,20,0.35)]">
        <div className="absolute inset-x-[12%] top-[14%] h-[44%] rounded-[8%] bg-graphite">
          <span className="orb absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ ["--orb" as string]: "9px" }} />
        </div>
        <div className="absolute bottom-[16%] left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="font-display text-[9px] font-semibold tracking-[-0.02em] text-ink">woven</span>
          <span className="mt-[2px] block h-[2px] w-[10px] rounded-full bg-amber" />
        </div>
        <span className="sr-only">{name}</span>
      </div>
    </Art>
  );
}

function Module() {
  return (
    <Art>
      <div className="absolute left-1/2 top-1/2 h-[48%] w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-[6px] bg-graphite shadow-[0_14px_24px_-14px_rgba(20,20,20,0.5)]">
        <div
          className="absolute inset-x-[8%] top-[12%] h-[52%] rounded-[3px]"
          style={{ background: "repeating-linear-gradient(90deg, #2a2a29 0 3px, #141414 3px 6px)" }}
        />
        <div
          className="absolute inset-x-[10%] bottom-[10%] h-[10%]"
          style={{ background: "repeating-linear-gradient(90deg, #c9962e 0 3px, transparent 3px 5px)" }}
        />
      </div>
    </Art>
  );
}

function Adapter() {
  return (
    <Art>
      <div className="absolute left-[16%] top-[30%] h-[40%] w-[34%] rounded-[8px] bg-bone-2 ring-1 ring-ink/10">
        <div className="absolute bottom-[26%] right-[-6%] h-[18%] w-[12%] rounded-[2px] bg-graphite" />
      </div>
      <div
        className="absolute left-[52%] top-[28%] h-[48%] w-[34%] rounded-r-[999px] border-[3px] border-l-0 border-ink/70"
        style={{ borderStyle: "dashed" }}
      />
      <div className="absolute left-[50%] top-[44%] h-[8%] w-[8%] rounded-[2px] bg-graphite" />
      <div className="absolute left-[50%] top-[71%] h-[8%] w-[8%] rounded-[2px] bg-graphite" />
    </Art>
  );
}

function FlatCable() {
  return (
    <Art>
      <div className="absolute left-[14%] top-[47%] h-[6%] w-[72%] rounded-full bg-ink/75" />
      <div className="absolute left-[8%] top-[40%] h-[20%] w-[10%] rounded-[2px] bg-graphite" />
      <div className="absolute right-[8%] top-[40%] h-[20%] w-[10%] rounded-[2px] bg-graphite" />
      <div className="absolute left-[10%] top-[60%] h-[3px] w-[6%] bg-amber" />
      <div className="absolute right-[10%] top-[60%] h-[3px] w-[6%] bg-amber" />
    </Art>
  );
}

function HdmiCable() {
  return (
    <Art>
      <div
        className="absolute left-[14%] top-[36%] h-[34%] w-[72%] border-[3px] border-b-0 border-ink/70"
        style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
      />
      <div className="absolute left-[8%] top-[64%] h-[12%] w-[14%] bg-graphite" style={{ clipPath: "polygon(0 0, 100% 0, 88% 100%, 12% 100%)" }} />
      <div className="absolute right-[8%] top-[64%] h-[12%] w-[14%] bg-graphite" style={{ clipPath: "polygon(0 0, 100% 0, 88% 100%, 12% 100%)" }} />
    </Art>
  );
}

function Sleds() {
  return (
    <Art>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="absolute left-1/2 h-[16%] w-[62%] -translate-x-1/2 rounded-[4px] bg-chassis ring-1 ring-ink/10"
          style={{ top: `${30 + i * 26}%` }}
        >
          <div className="absolute inset-y-[25%] left-[4%] w-[6%] rounded-[2px] bg-amber" />
          <div className="absolute inset-y-[30%] right-[6%] w-[46%] rounded-[2px] bg-ink/10" />
        </div>
      ))}
    </Art>
  );
}

function QuickCard() {
  return (
    <Art>
      <div className="absolute left-1/2 top-1/2 flex h-[60%] w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col justify-center gap-[6px] rounded-[6px] bg-bone px-4 ring-1 ring-ink/10">
        {["Plug in", "Scan", "Done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-[11px] font-medium text-ink">
            <span className="font-mono text-[11px] text-amber">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
    </Art>
  );
}

const invisible = [
  "Woven OS and Tandem",
  "Files, Photos, Media, Home, Cameras and TV apps",
  "1 year of Gate crossings credit",
  "Secure element keys that never leave the box",
  "2-year warranty and lifetime OS updates",
];

export function InTheBox({
  name = "Core+",
  adapter = "180 W",
  className = "",
}: {
  name?: string;
  adapter?: string;
  className?: string;
}) {
  const items: [string, string, React.ReactNode][] = [
    [`Woven ${name}`, "Chassis, screen, radios and drives, ready to go", <Chassis key="c" name={name} />],
    ["Compute module", "Seated and attested at the factory", <Module key="m" />],
    [`${adapter} USB-C PD adapter`, "Braided 2 m cable", <Adapter key="a" />],
    ["Ethernet cable", "2.5/10 GbE flat cable, 1.5 m", <FlatCable key="e" />],
    ["HDMI 2.1 cable", "2 m, to the television", <HdmiCable key="h" />],
    ["Two spare drive sleds", "Tool-less, for the second bay and later", <Sleds key="s" />],
    ["Quick card", "1 Plug in · 2 Scan · 3 Done", <QuickCard key="q" />],
  ];

  return (
    <div className={`w-full max-w-[720px] ${className}`}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map(([t, d, art]) => (
          <li key={t} className="rounded-[14px] bg-bone p-2.5 ring-1 ring-ink/5">
            {art}
            <div className="mt-2.5 px-1 pb-1">
              <div className="text-[13px] font-medium leading-snug">{t}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-ash">{d}</div>
            </div>
          </li>
        ))}
        <li className="col-span-2 rounded-[14px] bg-graphite px-5 py-4 text-bone sm:col-span-3 md:col-span-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">Also in the box, invisibly</div>
          <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px] leading-snug text-bone/90">
            {invisible.map((i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[6px] block h-[5px] w-[5px] shrink-0 rounded-full bg-amber-2" />
                {i}
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </div>
  );
}
