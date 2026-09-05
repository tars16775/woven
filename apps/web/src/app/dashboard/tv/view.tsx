"use client";

import { useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { TVFrame } from "@/components/tv-frame";
import { tv } from "@/lib/dashboard/data";

type Now = { kind: string; title: string; detail: string; rail?: string };

const railKind: Record<string, string> = {
  "Continue watching": "Video",
  Photos: "Photos",
  Cameras: "Camera",
};

const details: Record<string, string> = {
  Video: "Resumes where you left it · inside",
  Photos: "12 s each · from the box",
  Camera: "Live · detection on the NPU",
};

const modes: Record<string, Now> = {
  Photos: { kind: "Photos", title: "This week", detail: `${312} new · 12 s each` },
  Cameras: { kind: "Cameras", title: "All four", detail: "Live grid · inside" },
  Ask: { kind: "Ask", title: "Listening on the screen", detail: "Say “Tandem” or type on the remote" },
};

export function TVView() {
  const say = useToast();
  const [now, setNow] = useState<Now>({ ...tv.now, rail: "Photos" });
  const [playing, setPlaying] = useState(true);
  const [screenOn, setScreenOn] = useState(true);

  const show = (next: Now) => {
    setScreenOn(true);
    setPlaying(true);
    setNow(next);
  };

  const pick = (rail: string, item: string) => {
    const kind = railKind[rail] ?? rail;
    show({ kind, title: item, detail: details[kind] ?? "", rail });
  };

  const step = (dir: 1 | -1) => {
    const rail = tv.rails.find((r) => r.title === now.rail);
    if (!rail) return;
    const idx = rail.items.indexOf(now.title);
    const next = rail.items[(idx + dir + rail.items.length) % rail.items.length];
    pick(rail.title, next);
  };

  const stop = () => {
    setPlaying(false);
    setNow({ kind: "Home", title: "Home screen", detail: "Photos, cameras and a place to ask" });
  };

  const off = () => {
    setScreenOn(false);
    setPlaying(false);
    say("Screen off. The box keeps running; the TV wakes when you press anything.");
  };

  const pill = !screenOn ? <Pill>Off</Pill> : playing ? <Pill tone="good">Playing</Pill> : <Pill>Paused</Pill>;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="TV"
        sub={`${tv.name} · ${tv.connected} · included with every Core`}
        action={
          <div className="flex gap-2">
            {Object.keys(modes).map((k) => (
              <Button key={k} onClick={() => show(modes[k])} aria-pressed={screenOn && now.kind === modes[k].kind && now.title === modes[k].title}>
                {k}
              </Button>
            ))}
            <Button onClick={off} disabled={!screenOn} aria-pressed={!screenOn}>
              Off
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="dash-lock relative">
          <TVFrame />
          {!screenOn && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-[#0b0b0b]/95 text-[13px] text-ash-2" aria-hidden="true">
              Screen off
            </div>
          )}
        </div>
        <div className="grid gap-4">
          <Card title="Now on the screen">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{screenOn ? now.title : "Screen off"}</div>
                <div className="text-[13px] text-ash">{screenOn ? `${now.kind} · ${now.detail}` : "The box keeps running · press anything to wake"}</div>
              </div>
              {pill}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Button kind="soft" className="py-2.5 text-[14px]" onClick={() => step(-1)} disabled={!screenOn || !now.rail} aria-label="Previous">
                ◂
              </Button>
              <Button kind="soft" className="py-2.5 text-[14px]" onClick={() => setPlaying((p) => !p)} disabled={!screenOn} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "▮▮" : "▸"}
              </Button>
              <Button kind="soft" className="py-2.5 text-[14px]" onClick={() => step(1)} disabled={!screenOn || !now.rail} aria-label="Next">
                ▸▸
              </Button>
              <Button kind="soft" className="py-2.5 text-[14px]" onClick={stop} disabled={!screenOn}>
                Stop
              </Button>
            </div>
          </Card>
          {tv.rails.map((r) => (
            <Card key={r.title} title={r.title}>
              <ul className="flex flex-wrap gap-2">
                {r.items.map((it) => {
                  const on = screenOn && now.rail === r.title && now.title === it;
                  return (
                    <li key={it}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => pick(r.title, it)}
                        className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-ink text-bone" : "bg-bone hover:bg-chassis"}`}
                      >
                        {it}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          <Card>
            <p className="text-[13px] text-ash">
              Everything on the TV is served from the box over HDMI. Nothing you watch, browse or ask on the screen is reported to anyone.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
