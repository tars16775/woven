"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Card, Empty, PageHeader, Pill } from "@/components/dashboard/ui";
import { IconChevron, IconPlay, IconTv, IconX } from "@/components/dashboard/icons";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { bytes, media as api, photos as photosApi, type MediaItem, type Photo } from "@/lib/core/files";
import { CoreImage } from "@/components/dashboard/core-image";
import { useCoreUrl } from "@/lib/core/transport";
import { RoomNote } from "@/components/dashboard/room-note";

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
  // At home the player streams with byte ranges; away, the tunnel fetches the file once.
  const streamSrc = useCoreUrl(now ? api.streamUrl(now.fileId) : null);
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

  /* A slideshow that never advances is a still image with extra steps. It
     moves on its own every eight seconds, and stops the moment anything else
     is played or the person steps through it by hand. */
  const sliding = slideshow !== null;
  useEffect(() => {
    if (!sliding || photos.length === 0) return;
    const id = window.setInterval(() => setSlideshow((i) => (i === null ? null : (i + 1) % photos.length)), 8000);
    return () => window.clearInterval(id);
  }, [sliding, photos.length]);

  const stepSlide = (delta: number) => {
    setSlideshow((i) => (i === null || photos.length === 0 ? i : (i + delta + photos.length) % photos.length));
  };

  const play = (item: MediaItem) => {
    setSlideshow(null);
    setNow(item);
    if (!item.playable && !tools.ffmpeg) say("The box cannot transcode this one: ffmpeg is not installed.");
  };

  return (
    <div>
      <PageHeader
        title="TV"
        sub={`${videos.length} videos · ${music.length} tracks · ${photos.length} recent photos · from the box, over the house's own wire`}
        action={
          <Button kind="primary" className="px-5 py-2" onClick={fullscreen} data-testid="fullscreen">
            Fill this screen
          </Button>
        }
      />

      <RoomNote id="room:tv" />

      <div ref={stage} className="overflow-hidden rounded-[14px] bg-graphite text-bone ring-1 ring-white/8">
        <div className="relative aspect-video w-full bg-black">
          {now ? (
            now.kind === "video" ? (
              <video ref={player} key={now.fileId} src={streamSrc ?? undefined} crossOrigin="use-credentials" controls autoPlay playsInline className="h-full w-full" data-testid="player" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="font-display text-[28px] font-medium">{now.name}</div>
                <audio ref={player} key={now.fileId} src={streamSrc ?? undefined} crossOrigin="use-credentials" controls autoPlay className="w-[min(600px,80%)]" data-testid="player" />
              </div>
            )
          ) : slideshow !== null && photos[slideshow] ? (
            <>
              <CoreImage src={photosApi.previewUrl(photos[slideshow].id)} alt={photos[slideshow].name} className="h-full w-full object-contain" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
                <span className="tnum truncate font-mono text-[11px] uppercase tracking-[0.14em] text-bone/80">
                  {slideshow + 1} / {photos.length} · {photos[slideshow].name}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => stepSlide(-1)} aria-label="Previous photo" className="tap rounded-[8px] p-2 text-bone/80 hover:bg-white/15 hover:text-bone">
                    <IconChevron dir="left" size={18} />
                  </button>
                  <button type="button" onClick={() => stepSlide(1)} aria-label="Next photo" className="tap rounded-[8px] p-2 text-bone/80 hover:bg-white/15 hover:text-bone">
                    <IconChevron size={18} />
                  </button>
                  <button type="button" onClick={() => setSlideshow(null)} aria-label="Stop the slideshow" className="tap rounded-[8px] p-2 text-bone/80 hover:bg-white/15 hover:text-bone">
                    <IconX size={18} />
                  </button>
                </span>
              </div>
            </>
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

      {videos.length === 0 && music.length === 0 && photos.length === 0 ? (
        <div className="mt-6">
          <Empty
            icon={<IconTv size={28} />}
            title="Nothing to play yet"
            body="Videos, music and photos on your drive appear here, and play on whatever this browser is plugged into. Formats this screen cannot handle are converted by the box as they stream, so nothing has to be prepared in advance."
            action={
              <ButtonLink kind="primary" href="/dashboard/files" className="px-4 py-2">
                Put something in
              </ButtonLink>
            }
          />
        </div>
      ) : (
      <>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Videos" action={videos.length === 0 ? undefined : <Pill>{videos.length}</Pill>}>
          {videos.length === 0 ? (
            <p className="text-[14px] text-ash">Nothing yet. Upload a video on the Files page or back one up from a laptop.</p>
          ) : (
            <ul className="divide-y divide-ink/6" data-testid="videos">
              {videos.map((v) => (
                <li key={v.fileId} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <button type="button" onClick={() => play(v)} className="tap flex min-w-0 items-center gap-2 text-left font-medium hover:underline">
                    <IconPlay size={15} className="shrink-0 text-ash" />
                    <span className="truncate">{v.name}</span>
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
                  <button type="button" onClick={() => play(m)} className="tap flex min-w-0 items-center gap-2 text-left font-medium hover:underline">
                    <IconPlay size={15} className="shrink-0 text-ash" />
                    <span className="truncate">{m.name}</span>
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
                  <CoreImage src={photosApi.thumbUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </>
      )}
      <p className="mt-4 text-[12px] text-ash">{tools.ffmpeg ? "The box converts formats this screen cannot play, as it streams." : "Install ffmpeg on the box to play formats this screen cannot."}</p>
    </div>
  );
}
