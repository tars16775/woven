"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, Pill, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { photos as api, type Photo, type PhotoStats } from "@/lib/core/files";
import { useSession } from "@/lib/auth";

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

  useEffect(() => {
    let alive = true;
    Promise.all([api.timeline(), api.stats()])
      .then(([t, s]) => {
        if (!alive) return;
        setItems(t.photos);
        setCursor(t.cursor);
        setStats(s);
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

  const byMonth = new Map<string, Photo[]>();
  for (const p of items) {
    const k = p.takenAt.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), p]);
  }
  const canImport = session?.role === "owner" || session?.role === "adult";

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Photos"
        sub={stats ? `${stats.total.toLocaleString()} photos · ${stats.newThisWeek} new this week · ${stats.withPlace} with a place · indexed on the box, faces off` : "Reading the box…"}
        action={canImport ? <Button kind="primary" className="px-5 py-2" onClick={() => setImporting(true)}>Import a folder</Button> : undefined}
      />

      {stats && stats.total === 0 && (
        <Card>
          <p className="text-[14px] text-ash" data-testid="no-photos">
            No photos yet. Upload images on the Files page, or import a folder that is already on the box (an export from another library, for example). Every image becomes a photo the moment it lands.
          </p>
        </Card>
      )}

      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">
            {monthName(month)} <Pill>{stats?.months.find((m) => m.month === month)?.count ?? list.length}</Pill>
          </h2>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6" data-testid={`month-${month}`}>
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(p)} className="block aspect-square w-full overflow-hidden rounded-[8px] bg-chassis" aria-label={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the bytes come from the household's own box, not a CDN */}
                  <img src={api.thumbUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
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
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the box */}
            <img src={api.previewUrl(open.id)} alt={open.name} className="mx-auto max-h-[70vh] w-auto" />
          </div>
        )}
        <DialogActions>
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
