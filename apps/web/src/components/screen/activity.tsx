import { ScreenFrame } from "./frame";

const rows: [string, string, string, "inside" | "crossing"][] = [
  ["21:40", "Tandem", "Answered Maya: “When is the dentist?” · from the household calendar", "inside"],
  ["18:12", "Cameras", "Package at the front door · clip saved inside", "inside"],
  ["14:05", "Backup", "Sam's laptop · 4.1 GB synced · 312 photos indexed", "inside"],
  ["09:30", "Crossing", "Deep research: “compare heat pumps” · 1 task sent, no personal data", "crossing"],
];

const pills: [string, boolean][] = [
  ["Crossings: ask me", true],
  ["Cameras: inside", true],
  ["Voice: inside", true],
  ["Close the Gate", false],
];

/**
 * The Activity screen: one honest list of what stayed and what crossed.
 * Laid out as a column (title, meter, rows, controls) so nothing overlaps
 * whatever width the frame is given.
 */
export function ScreenActivity({ className = "" }: { className?: string }) {
  return (
    <ScreenFrame
      className={className}
      header="Activity"
      label="The box's Activity screen titled Where your data went today. A meter shows 98 percent stayed inside, with 1 crossing for deep research approved by Alex. Four rows: Tandem answered Maya from the household calendar; Cameras saved a package clip inside; Backup synced Sam's laptop and indexed 312 photos; one crossing sent a deep research task with no personal data. Controls read Crossings: ask me, Cameras: inside, Voice: inside, Close the Gate."
    >
      <div className="absolute inset-x-[4.5%] top-[16%] bottom-[6.5%] flex flex-col">
        <div className="font-display text-[clamp(12px,4.2cqw,34px)] font-semibold leading-none tracking-[-0.02em]">
          Where your data went today
        </div>
        <div className="mt-[2.2cqw] h-[clamp(3px,1.2cqw,9px)] w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[98%] rounded-full bg-amber" />
        </div>
        <div className="mt-[1.4cqw] text-[clamp(8px,1.7cqw,14px)] text-ash-2">
          98% stayed inside · 1 crossing (deep research, approved by Alex)
        </div>

        <div className="mt-[2.4cqw] space-y-[1cqw]">
          {rows.map(([t, k, d, where]) => (
            <div
              key={t}
              className="flex items-center gap-[2cqw] rounded-[clamp(4px,1.4cqw,12px)] bg-white/6 px-[2cqw] py-[1.1cqw] text-[clamp(8px,1.7cqw,14px)] leading-tight"
            >
              <span className="w-[8%] shrink-0 font-mono text-[clamp(7px,1.4cqw,11px)] text-ash-2">{t}</span>
              <span className={`w-[14%] shrink-0 truncate font-medium ${where === "crossing" ? "text-amber-2" : ""}`}>{k}</span>
              <span className="min-w-0 flex-1 truncate text-bone/80">{d}</span>
              <span
                className={`block h-[clamp(4px,1.2cqw,10px)] w-[clamp(4px,1.2cqw,10px)] shrink-0 rounded-full ${
                  where === "inside" ? "bg-amber-2" : "bg-ash-2/70"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-[2%] pt-[1.4cqw] @min-[440px]:grid-cols-4">
          {pills.map(([p, on]) => (
            <div
              key={p}
              className={`flex min-w-0 items-center gap-[1.2cqw] rounded-full px-[1.8cqw] py-[1cqw] text-[clamp(8px,1.6cqw,13px)] font-medium leading-tight ${
                on ? "bg-amber/12 text-amber-2 ring-1 ring-amber/30" : "bg-white/6 text-ash-2 ring-1 ring-white/8"
              }`}
            >
              <span className={`block h-[clamp(4px,1.1cqw,9px)] w-[clamp(4px,1.1cqw,9px)] shrink-0 rounded-full ${on ? "bg-amber-2" : "bg-ash-2"}`} />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </ScreenFrame>
  );
}
