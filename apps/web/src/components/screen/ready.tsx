import { ScreenFrame } from "./frame";

const tiles: [string, string][] = [
  ["Storage", "1.2 / 2 TB"],
  ["Memory", "38 / 64 GB"],
  ["Model", "gpt-oss-20b"],
  ["Temp", "41 °C · quiet"],
];

/** The idle screen: the light, the word, and four honest numbers. */
export function ScreenReady({ className = "" }: { className?: string }) {
  return (
    <ScreenFrame
      className={className}
      label="The box's front screen reading Ready. Tandem is running inside, 4 devices connected, Gate closed. Storage 1.2 of 2 TB, memory 38 of 64 GB, model gpt-oss-20b, temperature 41 degrees, quiet."
    >
      <div className="absolute inset-x-0 top-[24%] flex flex-col items-center text-center">
        <span className="orb" style={{ ["--orb" as string]: "clamp(10px,4cqw,32px)" }} />
        <div className="mt-[6cqw] font-display text-[clamp(22px,9cqw,72px)] font-semibold leading-none tracking-[-0.03em]">
          Ready.
        </div>
        <div className="mt-[1.6cqw] text-[clamp(9px,2cqw,16px)] text-ash-2">
          Tandem is running inside · 4 devices connected · Gate closed
        </div>
      </div>
      <div className="absolute inset-x-[4.5%] bottom-[6.5%] grid grid-cols-4 gap-[2.4%]">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-[clamp(4px,1.4cqw,12px)] bg-white/6 px-[1.8cqw] py-[1.6cqw] ring-1 ring-white/6">
            <div className="font-mono text-[clamp(7px,1.3cqw,10px)] uppercase tracking-[0.18em] text-ash-2">{k}</div>
            <div className="mt-[0.6cqw] truncate font-display text-[clamp(11px,2.4cqw,19px)] font-medium tracking-[-0.01em]">
              {v}
            </div>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}
