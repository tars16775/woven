"use client";

import { useEffect, useState } from "react";
import type { CameraEvent, CamerasState, CameraView } from "@woven/schema";
import { Button, Card, Empty, PageHeader, Pill, Rows, Skeleton, StatusDot, Switch } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { RoomNote } from "@/components/dashboard/room-note";
import { CoreImage } from "@/components/dashboard/core-image";
import { IconCameras, IconPause, IconPlay } from "@/components/dashboard/icons";
import { cameras as api } from "@/lib/core/cameras";
import { explainAction } from "@/lib/core/actions";
import { useSession } from "@/lib/auth";

const kindLabel: Record<CameraEvent["kind"], string> = {
  person: "Person",
  vehicle: "Vehicle",
  animal: "Animal",
  package: "Package",
  motion: "Movement",
};

const transportLabel: Record<CameraView["transport"], string> = {
  rtsp: "RTSP, on the Inside",
  onvif: "ONVIF, on the Inside",
  usb: "Wired to the box",
  builtin: "Built into the box",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** One camera: a still from the box, its name, and what it is doing. */
function Tile({ camera, paused, onOpen }: { camera: CameraView; paused: boolean; onOpen: () => void }) {
  const live = camera.state === "live" && !paused;
  const lost = camera.state === "lost";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="dash-lock tap block overflow-hidden rounded-[14px] bg-graphite text-left text-bone ring-1 ring-white/8 hover:ring-white/20"
      aria-label={`${camera.name}${camera.place ? `, ${camera.place}` : ""}`}
    >
      <div className="relative aspect-video bg-graphite-2">
        {live ? (
          <CoreImage src={api.snapshotUrl(camera.id)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] text-bone/80">{lost ? "Not answering" : "Paused · not recording"}</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone/85">
          <span className={`block h-[6px] w-[6px] rounded-full ${live ? "bg-[#d64545]" : lost ? "bg-ask" : "bg-ash-2"}`} />
          {live ? "Live · inside" : lost ? "Lost" : "Paused"}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{camera.name}</div>
          <div className="truncate text-[12px] text-ash-2">{camera.place ?? transportLabel[camera.transport]}</div>
        </div>
        <div className="shrink-0 text-right text-[12px] text-ash-2">
          <div>{camera.lastEventAt ? timeAgo(camera.lastEventAt) : "no events"}</div>
          <div className="tnum">{camera.retentionDays}-day clips</div>
        </div>
      </div>
    </button>
  );
}

/**
 * Cameras (dashboard design phase 14).
 *
 * Designed in full before the capture hardware exists, so the Core can be
 * built to a finished screen. Three states, and the room is honest about
 * which one it is in.
 *
 * A Mac has no capture hardware and no radios, so it reports `capture:
 * "absent"` and this says so plainly rather than showing an empty grid that
 * reads as a fault. A box with capture and nothing paired gets the empty
 * state. A box with cameras gets the grid.
 *
 * The pause control is one switch for the household, not one per camera,
 * because "are the cameras off?" is a question with a single answer, and an
 * answer assembled from six toggles is not one anybody trusts.
 */
export function CamerasView() {
  const say = useToast();
  const session = useSession();
  const [state, setState] = useState<CamerasState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState<CameraView | null>(null);
  const adult = session?.role === "owner" || session?.role === "adult";

  const load = () => {
    api
      .state()
      .then(setState)
      .catch((err: unknown) => setError(explainAction(err)));
  };

  useEffect(() => {
    let alive = true;
    api
      .state()
      .then((s) => alive && setState(s))
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, []);

  const setPaused = async (paused: boolean) => {
    if (busy) return;
    setBusy(true);
    setConfirm(false);
    try {
      await api.pauseAll(paused);
      say(paused ? "All cameras paused. Nothing is detected or recorded until you resume." : "Cameras are live again. Detection runs on the box.");
      load();
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(false);
    }
  };

  const setDetection = async (camera: CameraView, on: boolean) => {
    try {
      await api.setDetection(camera.id, on);
      load();
    } catch (err) {
      say(explainAction(err));
    }
  };

  const paused = state?.pausedAll ?? false;
  const liveCount = state ? state.cameras.filter((c) => c.state === "live" && !paused).length : 0;
  const lost = state ? state.cameras.filter((c) => c.state === "lost") : [];

  /* ------------------------------------------------------------- no capture */
  if (state?.capture === "absent") {
    return (
      <div>
        <PageHeader
          title="Cameras"
          sub="This Core has no camera capture."
          action={
            <Pill tone="neutral">
              <span data-testid="cameras-none">No cameras yet</span>
            </Pill>
          }
        />
        <RoomNote id="room:cameras" />
        <Empty
          icon={<IconCameras size={28} />}
          title="Nothing to capture with"
          body="Detection on the box's own processor, clips that never leave the drive, and one switch that stops all of it arrive with the box and its radios. A Mac has none of that hardware, and this page will not pretend otherwise. When cameras can be paired, they appear here."
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- reading */
  if (!state) {
    return (
      <div>
        <PageHeader title="Cameras" sub={error ?? "Reading the box…"} />
        <RoomNote id="room:cameras" />
        {error ? (
          <Card>
            <p role="alert" className="text-[14px] text-ask">
              {error}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="aspect-[16/11] w-full" rounded="lg" />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------ none paired */
  if (state.cameras.length === 0) {
    return (
      <div>
        <PageHeader title="Cameras" sub="Nothing is paired with this Core yet." />
        <RoomNote id="room:cameras" />
        <Empty
          icon={<IconCameras size={28} />}
          title="No cameras paired"
          body="A camera on the Inside network is found by the box and paired here. Its clips are written to your drive, detection runs on the box's own processor, and no footage reaches a service, a subscription or anyone else."
          action={adult ? <Button kind="primary" className="px-4 py-2">Look for cameras</Button> : undefined}
        />
      </div>
    );
  }

  /* ----------------------------------------------------------------- cameras */
  return (
    <div>
      <PageHeader
        title="Cameras"
        sub={
          paused
            ? "All paused · nothing is detected or recorded · clips you already have stay on the box"
            : `${liveCount} live · detection on the box · clips stay on the drive · no facial recognition`
        }
        action={
          adult ? (
            paused ? (
              <Button kind="primary" className="px-4 py-2" onClick={() => void setPaused(false)} disabled={busy} aria-busy={busy}>
                <IconPlay size={16} />
                Resume cameras
              </Button>
            ) : (
              <Button className="px-4 py-2" onClick={() => setConfirm(true)} disabled={busy} aria-busy={busy}>
                <IconPause size={16} />
                Pause all cameras
              </Button>
            )
          ) : undefined
        }
      />

      <RoomNote id="room:cameras" />

      {lost.length > 0 && (
        <Card className="mb-4" title="Not answering" action={<Pill tone="warn">{lost.length}</Pill>}>
          <p className="text-[14px] text-ash">
            {lost.map((c) => c.name).join(", ")} {lost.length === 1 ? "has" : "have"} stopped answering on the Inside network. Clips already written are
            still on the drive.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2" data-testid="camera-grid">
        {state.cameras.map((c) => (
          <Tile key={c.id} camera={c} paused={paused} onOpen={() => setOpen(c)} />
        ))}
      </div>

      <Card title="Events" className="mt-4" action={<StatusDot tone="good">Detected on the box</StatusDot>}>
        {state.events.length === 0 ? (
          <p className="py-2 text-[14px] text-ash">Nothing detected yet. Events appear here as they happen, with the clip beside them.</p>
        ) : (
          <Rows>
            {state.events.slice(0, 12).map((e) => {
              const cam = state.cameras.find((c) => c.id === e.cameraId);
              return (
                <div key={e.id} className="grid grid-cols-[86px_1fr_auto] items-baseline gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <span className="tnum font-mono text-[12px] text-ash">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{kindLabel[e.kind]}</span> <span className="text-ash">{cam?.name ?? "a camera"}</span>
                  </span>
                  <span className="tnum text-[12px] text-ash">{e.clipSeconds === null ? "no clip" : `${Math.round(e.clipSeconds)} s clip`}</span>
                </div>
              );
            })}
          </Rows>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="good">Detection: inside</Pill>
          <Pill tone="good">Clips: on your drive</Pill>
          <Pill>Faces: off by design</Pill>
        </div>
      </Card>

      {/* One camera, and the two things a household changes about it. */}
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        size="md"
        kicker={open ? transportLabel[open.transport] : ""}
        title={open?.name ?? ""}
      >
        {open && (
          <>
            <div className="mt-3 overflow-hidden rounded-[12px] bg-graphite">
              {open.state === "live" && !paused ? (
                <CoreImage src={api.snapshotUrl(open.id)} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center text-[13px] text-ash-2">Not streaming</div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-medium">Detect on this camera</div>
                <div className="mt-0.5 text-[12px] text-ash">Movement, people, vehicles and packages, recognised on the box. Never identity.</div>
              </div>
              <Switch checked={open.detection} onChange={(v) => void setDetection(open, v)} label={`Detection on ${open.name}`} disabled={!adult} />
            </div>
            <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-[130px_1fr]">
              <dt className="text-ash">Clips kept</dt>
              <dd className="tnum">{open.retentionDays} days, then deleted by the box</dd>
              <dt className="text-ash">Last event</dt>
              <dd>{open.lastEventAt ? `${timeAgo(open.lastEventAt)} · ${new Date(open.lastEventAt).toLocaleString()}` : "none"}</dd>
            </dl>
          </>
        )}
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setOpen(null)} data-autofocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="Class B · reversible" title="Pause all cameras?" tone="ask">
        <p className="mt-2 text-[14px] leading-relaxed text-ash">
          Detection and recording stop on all {state.cameras.length} {state.cameras.length === 1 ? "camera" : "cameras"} until you resume. Clips you
          already have stay on the drive, and the pause is written to Activity with your name.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={() => void setPaused(true)} data-autofocus>
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
