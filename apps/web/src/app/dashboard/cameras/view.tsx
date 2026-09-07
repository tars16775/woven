"use client";

import { useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { setCamerasPaused, useCamerasPaused } from "@/components/dashboard/state";
import { cameras } from "@/lib/dashboard/data";
import { useSession } from "@/lib/auth";
import { useCore } from "@/lib/core/store";

const events = [
  ["18:12", "Front door", "Package", "Clip saved · 14 s"],
  ["08:31", "Driveway", "Car", "Clip saved · 22 s"],
  ["Yesterday 21:10", "Hallway", "Person · Sam", "No clip · household member"],
  ["Yesterday 19:02", "Back garden", "Person", "Clip saved · 31 s"],
];

/** No camera capture exists on a Mac, and none is paired: the connected page says so instead of showing the preview. */
export function CamerasView() {
  const core = useCore();
  const session = useSession();
  if (core.phase === "connected" && session && !session.simulated) return <NoCamerasYet />;
  return <PreviewCameras />;
}

function NoCamerasYet() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Cameras" sub="Nothing is paired with this Core." action={<Pill tone="neutral"><span data-testid="cameras-none">No cameras yet</span></Pill>} />
      <Card title="What this means">
        <p className="text-[14px] leading-relaxed">
          This Core has no camera capture. Detection on the box&apos;s own processor, clips that stay inside, and the pause switch arrive with the box and its radios; a Mac has none of that hardware, and nothing here will pretend otherwise. When cameras can be paired, this page fills in with the real ones.
        </p>
      </Card>
    </div>
  );
}

function PreviewCameras() {
  const paused = useCamerasPaused();
  const [confirm, setConfirm] = useState(false);
  const say = useToast();

  const live = paused ? 0 : cameras.filter((c) => c.live).length;

  const pauseAll = () => {
    setCamerasPaused(true);
    setConfirm(false);
    say("All cameras paused. Nothing is detected or recorded until you resume.");
  };

  const resumeAll = () => {
    setCamerasPaused(false);
    say("Cameras are live again. Detection runs on the NPU, inside.");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Cameras"
        sub={
          paused
            ? "All paused · nothing is detected or recorded · clips you already have stay on the box"
            : `${live} live · detection on the NPU · clips stay on the box · no facial recognition`
        }
        action={
          <div className="flex items-center gap-2">
            <Pill tone="warn">Preview</Pill>
            {paused ? <Button onClick={resumeAll}>Resume cameras</Button> : <Button onClick={() => setConfirm(true)}>Pause all cameras</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {cameras.map((c) => {
          const isLive = c.live && !paused;
          return (
            <div key={c.id} className="dash-lock overflow-hidden rounded-[14px] bg-graphite text-bone ring-1 ring-white/8">
              <div className="relative aspect-video">
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${isLive ? "opacity-100" : "opacity-30"}`}
                  style={{ background: "radial-gradient(ellipse at 50% 60%, #2c2c2a 0%, #141414 72%)" }}
                />
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${isLive ? "opacity-[0.18]" : "opacity-0"}`}
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 2px)",
                  }}
                />
                <div className="absolute inset-x-[8%] bottom-[18%] h-px bg-white/10" />
                <div className="absolute left-3 top-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone/80">
                  <span className={`block h-[6px] w-[6px] rounded-full ${isLive ? "bg-[#d64545]" : "bg-ash-2"}`} />
                  {isLive ? "Live" : "Paused"} · inside
                </div>
                {!isLive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] text-bone/80">Paused · not recording</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 text-[14px] font-medium">{c.name}</div>
                <div className="absolute bottom-3 right-3 font-mono text-[11px] text-bone/60">Stream renders from the box</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-[13px]">
                <span className="text-ash-2">Last event · {c.lastEvent}</span>
                <span className="text-ash-2">{c.retentionDays}-day retention</span>
              </div>
            </div>
          );
        })}
      </div>

      <Card title="Events" className="mt-4">
        <ul className="divide-y divide-ink/6">
          {events.map(([t, cam, what, note]) => (
            <li
              key={t + cam}
              className="grid grid-cols-[110px_1fr_auto] items-baseline gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0 md:grid-cols-[130px_160px_1fr_auto]"
            >
              <span className="font-mono text-[12px] text-ash">{t}</span>
              <span className="font-medium">{cam}</span>
              <span className="hidden md:block">{what}</span>
              <span className="text-[12px] text-ash">{note}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="good">Detection: inside</Pill>
          <Pill tone="good">Clips: on the box</Pill>
          <Pill>Faces: off by design</Pill>
        </div>
      </Card>

      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="Class B · reversible" title="Pause all cameras?">
        <p className="mt-2 text-[14px] text-ash">
          Detection and recording stop on all {cameras.length} cameras until you resume. Clips you already have stay, and the pause is written to Activity with your name.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={pauseAll} data-autofocus>
            Pause all
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirm(false)}>
            Keep watching
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
