"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, Empty, Skeleton, Field, PageHeader, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { models as modelsApi, photos as api, type ModelView, type Photo, type PhotoStats } from "@/lib/core/files";
import { actions, describe } from "@/lib/core/actions";
import { identity } from "@/lib/core/identity";
import { Approvals } from "@/components/dashboard/approvals";
import { CoreImage } from "@/components/dashboard/core-image";
import { useSession } from "@/lib/auth";
import { RoomNote } from "@/components/dashboard/room-note";
import { IconChevron, IconPhotos, IconSearch } from "@/components/dashboard/icons";

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/**
 * The Photos page against a real Core (phase 20): a timeline by month from
 * the thumbnails the box rendered once, a lightbox with the preview, and an
 * import from a folder on the box. No faces; that stays off as promised.
 */
export function LivePhotos() {
  const say = useToast();
  const session = useSession();
  const [items, setItems] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [importing, setImporting] = useState(false);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [model, setModel] = useState<ModelView | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ ready: boolean; results: (Photo & { score: number })[]; indexed: number; total: number } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.timeline(), api.stats(), modelsApi.list().catch(() => [] as ModelView[])])
      .then(([t, s, m]) => {
        if (!alive) return;
        setItems(t.photos);
        setCursor(t.cursor);
        setStats(s);
        setModel(m.find((x) => x.name === "photo-search") ?? null);
      })
      .catch((err: unknown) => alive && say(explainAction(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const more = async () => {
    if (!cursor) return;
    const t = await api.timeline(cursor);
    setItems((p) => [...p, ...t.photos]);
    setCursor(t.cursor);
  };

  const runImport = async () => {
    if (!folder.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api.importFolder(folder.trim());
      say(`${r.photos} new photos from ${r.files} image files · receipt written`);
      setImporting(false);
      setTick((t) => t + 1);
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(false);
    }
  };

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) return setResults(null);
    try {
      setResults(await api.search(q.trim()));
    } catch (err) {
      say(explainAction(err));
    }
  };

  /** The model host must be on the Gate's allow list first: a class H action the owner confirms with a passkey. */
  const allowHost = async (host: string) => {
    const prepared = await actions.prepare({ capability: "gate.allow", target: "gate", parameters: { host, reason: "photo search model" } });
    if (prepared.status !== "prepared") return prepared;
    const assertion = await identity.assert(session?.email || undefined);
    const approved = await actions.approve(prepared.id, assertion);
    return approved.status === "approved" ? actions.execute(prepared.id) : approved;
  };

  const turnOnSearch = async () => {
    if (asking) return;
    setAsking(true);
    try {
      for (const host of ["huggingface.co", "*.hf.co"]) {
        const r = await allowHost(host);
        if (r.status !== "succeeded") {
          say(describe(r));
          return;
        }
      }
      const prepared = await modelsApi.install("photo-search");
      if (prepared.status === "prepared") {
        // The owner approves the crossing; the download then runs on the box.
        const approved = await actions.approve(prepared.id);
        const done = approved.status === "approved" ? await actions.execute(prepared.id) : approved;
        say(done.status === "succeeded" ? "Photo search is on. The box is reading your photos now." : describe(done));
      } else say(describe(prepared));
      setTick((t) => t + 1);
    } catch (err) {
      say(explainAction(err));
    } finally {
      setAsking(false);
    }
  };

  /* One tile, used by the timeline, the search results and nothing else, so a
     change to how a photo looks lands in both places at once. */
  const Tile = ({ photo, onOpen }: { photo: Photo; onOpen: () => void }) => (
    <button
      type="button"
      onClick={onOpen}
      aria-label={photo.name}
      className="tap block aspect-square w-full overflow-hidden rounded-[8px] bg-chassis hover:opacity-90"
    >
      <CoreImage src={api.thumbUrl(photo.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
    </button>
  );

  const byMonth = new Map<string, Photo[]>();
  for (const p of items) {
    const k = p.takenAt.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), p]);
  }
  const canImport = session?.role === "owner" || session?.role === "adult";

  /* Whatever the grid is showing is what the lightbox walks through, so the
     arrows follow search results when a search is open and the timeline
     otherwise. */
  const shown = results ? results.results.slice(0, 24) : items;
  const step = (delta: number) => {
    if (!open) return;
    const i = shown.indexOf(open);
    const next = shown[i + delta];
    if (i >= 0 && next) setOpen(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown]);


  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Photos"
        sub={stats ? `${stats.total.toLocaleString()} photos · ${stats.newThisWeek} new this week · ${stats.withPlace} with a place · indexed on the box, faces off` : "Reading the box…"}
        action={canImport ? <Button kind="primary" className="px-5 py-2" onClick={() => setImporting(true)}>Import a folder</Button> : undefined}
      />

      <RoomNote id="room:photos" />

      <Approvals />

      {model && !model.installed && canImport && stats && stats.total > 0 && (
        <Card dark className="mb-4" title="Find photos by what is in them" action={<Pill tone="dark">On the box</Pill>}>
          <p className="text-[14px] text-ash-2">
            {model.purpose} The model is about {Math.round(model.approxBytes / 1024 / 1024)} MB. Turning it on asks you, with your passkey, to allow huggingface.co on the Gate, then the files come in once; after that nothing about your photos ever leaves.
          </p>
          <div className="mt-3">
            <Button kind="primary" onClick={turnOnSearch} disabled={asking} aria-busy={asking} data-testid="turn-on-search">
              {asking ? "Asking the Gate…" : "Turn on photo search"}
            </Button>
          </div>
        </Card>
      )}

      {model?.installed && (
        <div className="mb-4">
          <label className="sr-only" htmlFor="photo-search">
            Search photos
          </label>
          <div className="relative">
            <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ash" />
            <input
              id="photo-search"
              className={`${inputClass} py-3 pl-11 text-[15px]`}
              placeholder="the lake trip, a red bicycle, snow…"
              value={query}
              onChange={(e) => void search(e.target.value)}
              data-testid="photo-search"
            />
          </div>
          {results && (
            <p className="mt-2 text-[12px] text-ash">
              {results.indexed} of {results.total} photos searchable{results.indexed < results.total ? " · the rest are being read" : ""}
            </p>
          )}
        </div>
      )}

      {results && (
        <section className="mt-2">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">Best matches</h2>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6" data-testid="search-results">
            {results.results.slice(0, 24).map((p) => (
              <li key={p.id}>
                <Tile photo={p} onOpen={() => setOpen(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nothing read yet: hold the shape of the grid rather than an empty page. */}
      {!stats && (
        <ul className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i}>
              <Skeleton className="aspect-square w-full" rounded="sm" />
            </li>
          ))}
        </ul>
      )}

      {stats && stats.total === 0 && (
        <div data-testid="no-photos">
          <Empty
            icon={<IconPhotos size={28} />}
            title="No photos yet"
            body="Every image that lands on the box becomes a photo: its date, camera and place are read from the file itself and kept here. Faces are off by design, and search runs on your Core, which is why it still works with the Gate closed."
            action={
              <>
                {canImport && (
                  <Button kind="primary" className="px-4 py-2" onClick={() => setImporting(true)}>
                    Import a folder
                  </Button>
                )}
                <ButtonLink kind="soft" href="/dashboard/files" className="px-4 py-2">
                  Upload from Files
                </ButtonLink>
              </>
            }
          />
        </div>
      )}

      {!results && [...byMonth.entries()].map(([month, list]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">
            {monthName(month)} <Pill>{stats?.months.find((m) => m.month === month)?.count ?? list.length}</Pill>
          </h2>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6" data-testid={`month-${month}`}>
            {list.map((p) => (
              <li key={p.id}>
                <Tile photo={p} onOpen={() => setOpen(p)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {cursor && (
        <div className="mt-6 text-center">
          <Button onClick={more}>Older photos</Button>
        </div>
      )}

      <Dialog open={open !== null} onClose={() => setOpen(null)} size="md" kicker={open ? `${new Date(open.takenAt).toLocaleString()}${open.camera ? ` · ${open.camera}` : ""}${open.place ? " · has a place" : ""}` : ""} title={open?.name ?? ""}>
        {open && (
          <div className="mt-3 overflow-hidden rounded-[10px] bg-graphite">
            <CoreImage src={api.previewUrl(open.id)} alt={open.name} className="mx-auto max-h-[70vh] w-auto" />
          </div>
        )}
        <DialogActions>
          <Button kind="soft" className="px-4 py-2.5" onClick={() => step(-1)} disabled={!open || shown.indexOf(open) <= 0} aria-label="Previous photo">
            <IconChevron dir="left" size={16} />
          </Button>
          <Button kind="soft" className="px-4 py-2.5" onClick={() => step(1)} disabled={!open || shown.indexOf(open) >= shown.length - 1} aria-label="Next photo">
            <IconChevron size={16} />
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setOpen(null)} data-autofocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importing} onClose={() => setImporting(false)} kicker="On the box" title="Import a folder">
        <p className="mt-2 text-[14px] text-ash">A folder already on the box, for example an export from another photo library copied to the volume. Nothing is uploaded; the box reads it in place and keeps a copy of its own.</p>
        <Field label="Folder path on the box">
          <input className={inputClass} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="/Volumes/Woven/Photo export" data-autofocus />
        </Field>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={runImport} disabled={busy || !folder.trim()} aria-busy={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setImporting(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
