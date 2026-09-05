import type { CSSProperties } from "react";

/*
 * Static CSS stand-ins for the WebGL scenes. Same tokens as the rest of the
 * site: a graphite card, bone type, one amber accent. They carry the same
 * information as the 3D models so a browser without WebGL loses nothing.
 */

const card = "grid w-full gap-5 overflow-hidden rounded-[18px] bg-graphite p-5 text-bone ring-1 ring-white/10 sm:p-6";
const eyebrow = "font-mono text-[10px] uppercase tracking-[0.18em] text-ash-2";

function Callout({ n, style }: { n: number; style: CSSProperties }) {
  return (
    <span
      className="absolute flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-2 font-mono text-[10px] font-medium text-ink ring-2 ring-graphite"
      style={style}
    >
      {n}
    </span>
  );
}

const moduleParts = [
  ["Fin stack", "26 fins"],
  ["Vapour chamber", "over SoC and memory"],
  ["Processor", "Ryzen AI Max 390"],
  ["Memory", "4 packages · 64 GB"],
  ["Edge connector", "44 gold contacts"],
  ["Handle", "no tools"],
] as const;

/** The compute module seen from above, with its parts numbered. */
export function ModuleDiagram() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={`${card} max-w-[760px] sm:grid-cols-[1.35fr_1fr]`}>
        <div className="relative aspect-[13/9] rounded-[12px] bg-graphite-2 p-[7%] ring-1 ring-white/10">
          {/* Tray */}
          <div className="relative h-full w-full rounded-[6px] bg-[#2a2a29] ring-1 ring-white/10">
            {/* Handle on the back edge */}
            <div className="absolute left-[30%] right-[30%] top-[-6%] h-[7%] rounded-full bg-[#8f8d86]" />
            {/* Board */}
            <div className="absolute inset-[5%] rounded-[3px] bg-[#0f1713]" />
            {/* Power stages along the back */}
            <div
              className="absolute left-[12%] right-[12%] top-[9%] h-[8%]"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, #2c2c2c 0 9%, transparent 9% 16.6%)" }}
            />
            {/* Memory packages */}
            {[
              ["18%", "30%"],
              ["18%", "56%"],
              ["68%", "30%"],
              ["68%", "56%"],
            ].map(([left, top]) => (
              <div key={left + top} className="absolute h-[12%] w-[14%] rounded-[2px] bg-[#111213] ring-1 ring-white/10" style={{ left, top }} />
            ))}
            {/* Vapour chamber and fin stack */}
            <div className="absolute left-[15%] right-[19%] top-[24%] h-[46%] rounded-[3px] bg-[#8e8b82]" />
            <div
              className="absolute left-[17%] right-[21%] top-[26%] h-[42%] rounded-[2px]"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, #c9c6bd 0 2px, #4a4945 2px 3px, #b3b0a7 3px 4px, transparent 4px 6px)" }}
            />
            {/* Edge connector with gold pins */}
            <div className="absolute inset-x-[10%] bottom-[-3%] h-[7%] rounded-[2px] bg-[#0c0c0c]">
              <div
                className="absolute inset-y-[25%] inset-x-[2%]"
                style={{ backgroundImage: "repeating-linear-gradient(90deg, #d6a63a 0 2px, transparent 2px 5px)" }}
              />
            </div>
            {/* Label on the tray lip */}
            <div className="absolute bottom-[9%] left-[9%] font-mono text-[9px] uppercase tracking-[0.18em] text-bone/85 sm:text-[10px]">
              Compute Module A1
            </div>
            <Callout n={1} style={{ left: "44%", top: "26%" }} />
            <Callout n={2} style={{ left: "84%", top: "47%" }} />
            <Callout n={3} style={{ left: "48%", top: "72%" }} />
            <Callout n={4} style={{ left: "25%", top: "62%" }} />
            <Callout n={5} style={{ left: "70%", top: "97%" }} />
            <Callout n={6} style={{ left: "50%", top: "-3%" }} />
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className={eyebrow}>Compute Module A1 · 13 × 9 cm</div>
          <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] leading-snug sm:grid-cols-1 sm:gap-y-2 sm:text-[13px]">
            {moduleParts.map(([name, spec], i) => (
              <li key={name} className="flex items-baseline gap-2.5">
                <span className="font-mono text-[10px] text-amber-2">{i + 1}</span>
                <span>
                  {name}
                  <span className="block text-ash-2 sm:inline sm:before:content-['_·_']">{spec}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const stays = ["Drive 1 · 2 TB", "Drive 2 · empty", "Radios · Wi‑Fi, Thread, Zigbee", "Keys · secure element", "Ports · 2.5 GbE, USB‑C, HDMI"];
const steps = [
  ["Power down.", "Household storage locks itself."],
  ["Lift the lid. Pull the module.", "One handle, no tools."],
  ["Seat the new one.", "Identity and power checked before anything unlocks."],
  ["Everything is still here.", "Files, users, devices, automations, receipts."],
] as const;

/** The chassis opened up: what stays, what swaps, and the four steps. */
export function InsideDiagram() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={`${card} max-w-[880px] sm:grid-cols-[1fr_1.3fr]`}>
        {/* The chassis: everything that stays */}
        <div className="rounded-[12px] bg-graphite-2 p-4 ring-1 ring-white/10">
          <div className={eyebrow}>Chassis · stays 8 to 10 years</div>
          <ul className="mt-3 grid gap-1.5 sm:gap-2">
            {stays.map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-[8px] bg-white/6 px-3 py-1.5 text-[12px] sm:py-2 sm:text-[13px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-2" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-3 h-px bg-amber-2/70" />
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-2">Stays put</div>
        </div>

        {/* The bay: the one part that swaps */}
        <div className="flex flex-col rounded-[12px] border border-dashed border-white/20 p-4">
          <div className={eyebrow}>Module bay · swaps in sixty seconds</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-[8px] bg-[#2a2a29] p-3 ring-1 ring-white/10 opacity-60">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em]">Compute Module A1</div>
              <div className="mt-0.5 text-[12px] text-ash-2">Ryzen AI Max 390 · 64 GB</div>
            </div>
            <span aria-hidden="true" className="font-display text-[20px] text-amber-2">
              →
            </span>
            <div className="flex-1 rounded-[8px] bg-[#2a2a29] p-3 ring-1 ring-amber/70">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em]">Compute Module B2</div>
              <div className="mt-0.5 text-[12px] text-ash-2">Next generation · 128 GB</div>
            </div>
          </div>
          <ol className="mt-4 hidden gap-2 text-[13px] sm:grid">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-amber-2">{i + 1}</span>
                <span>
                  {t} <span className="text-ash-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
