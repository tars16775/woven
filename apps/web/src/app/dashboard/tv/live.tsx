"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { bytes, media as api, photos as photosApi, type MediaItem, type Photo } from "@/lib/core/files";

const clock = (s: number | null) => (s === null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

/**
 * The TV page against a real Core (phase 22): the household's videos and
 * music from the box, played here or full screen on whatever this browser
 * is plugged into (the living room TV over HDMI), and the week's photos as
 * a rail. Files a browser cannot play come transcoded from the box.
 */
export function LiveTV() {
  const say = useToast();
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [music, setMusic] = useState<MediaItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tools, setTools] = useState({ ffmpeg: false, ffprobe: false });
  const [now, setNow] = useState<MediaItem | null>(null);
  const [slideshow, setSlideshow] = useState<number | null>(null);
  const player = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.list("video"), api.list("audio"), photosApi.timeline()])
      .then(([v, a, p]) => {
        if (!alive) return;
        setVideos(v.items);
        setMusic(a.items);
        setTools(v.tools);
        setPhotos(p.photos.slice(0, 40));
      })
      .catch((err: unknown) => alive && say(explainAction(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (slideshow === null || photos.length === 0) return;
    const t = setInterval(() => setSlideshow((i) => ((i ?? 0) + 1) % photos.length), 8000);
    return () => clearInterval(t);
  }, [slideshow, photos.length]);

  const fullscreen = async () => {
    try {
      await stage.current?.requestFullscreen?.();
    } catch {
      say("This screen does not allow full screen from here.");
    }
  };

  const play = (item: MediaItem) => {
    setSlideshow(null);
    setNow(item);
    if (!item.playable && !tools.ffmpeg) say("The box cannot transcode this one: ffmpeg is not installed.");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="TV"
        sub={`${videos.length} videos · ${music.length} tracks · ${photos.length} recent photos · from the box, over the house's own wire`}
        action={
          <Button kind="primary" className="px-5 py-2" onClick={fullscreen} data-testid="fullscreen">
            Fill this screen
          </Button>
        }
      />

      <div ref={stage} className="overflow-hidden rounded-[14px] bg-graphite text-bone ring-1 ring-white/8">
        <div className="relative aspect-video w-full bg-black">
          {now ? (
            now.kind === "video" ? (
              <video ref={player} key={now.fileId} src={api.streamUrl(now.fileId)} crossOrigin="use-credentials" controls autoPlay playsInline className="h-full w-full" data-testid="player" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="font-display text-[28px] font-medium">{now.name}</div>
                <audio ref={player} key={now.fileId} src={api.streamUrl(now.fileId)} crossOrigin="use-credentials" controls autoPlay className="w-[min(600px,80%)]" data-testid="player" />
              </div>
            )
          ) : slideshow !== null && photos[slideshow] ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the box
            <img src={photosApi.previewUrl(photos[slideshow].id)} alt={photos[slideshow].name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="orb" style={{ ["--orb" as string]: "14px" }} />
              <div className="font-display text-[26px] font-medium">Ready.</div>
              <div className="text-[13px] text-ash-2">Pick something below. Plug this device into the TV and fill the screen.</div>
            </div>
          )}
        </div>
        {now && (
          <div className="flex items-center justify-between px-4 py-3 text-[13px] text-ash-2">
            <span>
              {now.name}
              {now.durationS ? ` · ${clock(now.durationS)}` : ""}
              {now.width ? ` · ${now.width}×${now.height}` : ""}
            </span>
            <span>{now.playable ? "Playing the original" : "Transcoded by the box as it plays"}</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Videos" action={videos.length === 0 ? undefined : <Pill>{videos.length}</Pill>}>
          {videos.length === 0 ? (
            <p className="text-[14px] text-ash">Nothing yet. Upload a video on the Files page or back one up from a laptop.</p>
          ) : (
            <ul className="divide-y divide-ink/6" data-testid="videos">
              {videos.map((v) => (
                <li key={v.fileId} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <button type="button" onClick={() => play(v)} className="min-w-0 truncate text-left font-medium hover:underline">
                    {v.name}
                  </button>
                  <span className="shrink-0 text-[12px] text-ash">
                    {clock(v.durationS)} · {bytes(v.size)} {!v.playable && <Pill tone="warn">via the box</Pill>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Music" action={music.length === 0 ? undefined : <Pill>{music.length}</Pill>}>
          {music.length === 0 ? (
            <p className="text-[14px] text-ash">No tracks yet.</p>
          ) : (
            <ul className="divide-y divide-ink/6" data-testid="music">
              {music.map((m) => (
                <li key={m.fileId} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <button type="button" onClick={() => play(m)} className="min-w-0 truncate text-left font-medium hover:underline">
                    {m.name}
                  </button>
                  <span className="shrink-0 text-[12px] text-ash">{clock(m.durationS)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Photos" className="mt-4" action={photos.length ? <Button kind="soft" onClick={() => { setNow(null); setSlideshow(0); }}>Slideshow</Button> : undefined}>
        {photos.length === 0 ? (
          <p className="text-[14px] text-ash">No photos yet.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-10">
            {photos.slice(0, 20).map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setNow(null); setSlideshow(i); }} className="block aspect-square w-full overflow-hidden rounded-[6px] bg-chassis" aria-label={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by the box */}
                  <img src={photosApi.thumbUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-[12px] text-ash">{tools.ffmpeg ? "The box transcodes formats this screen cannot play." : "Install ffmpeg on the box to play formats this screen cannot."}</p>
    </div>
  );
}
