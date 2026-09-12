"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Empty, Menu, Meter, PageHeader, Pill, Segmented, SkeletonRows } from "@/components/dashboard/ui";
import { IconDownload, IconFiles, IconUpload } from "@/components/dashboard/icons";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explainAction } from "@/lib/core/actions";
import { bytes, files, shares, type FileEntry, type FileListing, type FilesSummary, type Share } from "@/lib/core/files";
import { useSession } from "@/lib/auth";
import { isRemoteUrl, openCoreUrl } from "@/lib/core/transport";
import type { Namespace } from "@woven/schema";
import { RoomNote } from "@/components/dashboard/room-note";

const spaces: { id: Namespace; label: string; hint: string }[] = [
  { id: "personal", label: "Mine", hint: "Only you. Not even the owner." },
  { id: "household", label: "Household", hint: "Everyone in the house." },
  { id: "children", label: "Children", hint: "Adults and the children." },
  { id: "work", label: "Work", hint: "Yours, kept apart." },
];

/**
 * The Files page against a real Core (phase 19): browse by namespace and
 * folder, upload in chunks, open or save, move or share, delete. Every
 * change is the Core's; the page only asks.
 */
export function LiveFiles() {
  const say = useToast();
  const session = useSession();
  const [namespace, setNamespace] = useState<Namespace>("personal");
  const [path, setPath] = useState("/");
  const [listing, setListing] = useState<FileListing | null>(null);
  const [summary, setSummary] = useState<FilesSummary | null>(null);
  const [progress, setProgress] = useState<{ name: string; sent: number; total: number } | null>(null);
  const [share, setShare] = useState<FileEntry | null>(null);
  const [rename, setRename] = useState<{ file: FileEntry; name: string } | null>(null);
  const [link, setLink] = useState<{ file: FileEntry; hours: number; made: { share: Share; url: string } | null } | null>(null);
  const [links, setLinks] = useState<Share[]>([]);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([files.list(namespace, path), files.summary()])
      .then(([l, s]) => {
        if (!alive) return;
        setListing(l);
        setSummary(s);
        setError(null);
      })
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, [namespace, path, tick]);

  const refresh = () => setTick((t) => t + 1);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of chosen) {
      setProgress({ name: f.name, sent: 0, total: f.size });
      try {
        await files.upload(f, { namespace, path, onProgress: (sent, total) => setProgress({ name: f.name, sent, total }) });
        say(`${f.name} is on the box · receipt written`);
      } catch (err) {
        say(explainAction(err));
      }
    }
    setProgress(null);
    refresh();
  };

  const remove = async (f: FileEntry) => {
    try {
      await files.remove(f.id);
      say(`${f.name} deleted.`);
      refresh();
    } catch (err) {
      say(explainAction(err));
    }
  };

  const doShare = async (to: Namespace) => {
    if (!share) return;
    try {
      await files.move(share.id, { namespace: to });
      say(`${share.name} moved to ${spaces.find((s) => s.id === to)?.label ?? to} · receipt written`);
      setShare(null);
      refresh();
    } catch (err) {
      say(explainAction(err));
    }
  };

  const makeLink = async () => {
    if (!link || link.made) return;
    try {
      const r = await shares.create(link.file.id, { expiresInHours: link.hours });
      setLink({ ...link, made: { share: r.share, url: shares.url(r.token) } });
      setLinks(await shares.list());
      say("Link made · receipt written");
    } catch (err) {
      say(explainAction(err));
    }
  };
  const copyLink = async () => {
    if (!link?.made) return;
    try {
      await navigator.clipboard.writeText(link.made.url);
      say("Link copied.");
    } catch {
      say("Select the link and copy it.");
    }
  };
  const revokeLink = async (s: Share) => {
    try {
      await shares.revoke(s.id);
      setLinks(await shares.list());
      say(`The link to ${s.name} is off.`);
    } catch (err) {
      say(explainAction(err));
    }
  };
  useEffect(() => {
    let alive = true;
    shares
      .list()
      .then((l) => alive && setLinks(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tick]);

  const doRename = async () => {
    if (!rename || !rename.name.trim()) return;
    try {
      await files.move(rename.file.id, { name: rename.name.trim() });
      setRename(null);
      refresh();
    } catch (err) {
      say(explainAction(err));
    }
  };

  const crumbs = path === "/" ? [] : path.slice(1).split("/");
  const mine = summary?.byPerson.find((p) => p.personId === session?.personId);
  const quotaLine = mine ? `${bytes(mine.bytes)} yours${mine.quotaBytes ? ` of ${bytes(mine.quotaBytes)}` : ""}` : null;
  const disk = summary?.disk;
  const visible = spaces.filter((s) => session?.role !== "child" || s.id === "personal" || s.id === "household").filter((s) => session?.role !== "guest" || s.id === "personal");

  return (
    <div>
      <PageHeader
        title="Files"
        sub={disk ? `${bytes(disk.usedBytes)} of ${bytes(disk.totalBytes)} used on the box${quotaLine ? ` · ${quotaLine}` : ""} · stored once, however many devices` : "Reading the box…"}
        action={
          <>
            <input ref={input} type="file" multiple className="sr-only" aria-label="Choose files to upload" onChange={upload} data-testid="upload-input" />
            <Button kind="primary" className="px-5 py-2" onClick={() => input.current?.click()} disabled={progress !== null} data-testid="upload">
              {progress ? `Uploading ${progress.name}…` : "Upload"}
            </Button>
          </>
        }
      />

      <RoomNote id="room:files" />

      {progress && (
        <Card className="mb-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">{progress.name}</span>
            <span className="text-ash">
              {bytes(progress.sent)} of {bytes(progress.total)}
            </span>
          </div>
          <Meter value={progress.sent} max={Math.max(1, progress.total)} className="mt-2" />
        </Card>
      )}

      <Segmented
        label="Space"
        value={namespace}
        onChange={(id) => {
          setNamespace(id);
          setPath("/");
        }}
        options={visible.map((s) => ({ id: s.id, label: s.label }))}
      />
      <p className="mt-2 text-[13px] text-ash">{visible.find((s) => s.id === namespace)?.hint}</p>

      {/* The space is already named by the tab above; the crumb only earns its
          line once there is somewhere to go back to. */}
      <nav aria-label="Folder" className={`mt-4 flex-wrap items-center gap-1 text-[13px] text-ash ${crumbs.length === 0 ? "hidden" : "flex"}`}>
        <button type="button" onClick={() => setPath("/")} className="font-medium text-ink hover:underline">
          {spaces.find((s) => s.id === namespace)?.label}
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <span>/</span>
            <button type="button" onClick={() => setPath(`/${crumbs.slice(0, i + 1).join("/")}`)} className="hover:underline">
              {c}
            </button>
          </span>
        ))}
      </nav>

      <Card className="mt-3">
        {error ? (
          <p className="text-[14px] text-ask">{error}</p>
        ) : !listing ? (
          <SkeletonRows count={4} />
        ) : listing.folders.length === 0 && listing.files.length === 0 ? (
          <div data-testid="empty">
            <Empty
              icon={<IconFiles size={28} />}
              title={path === "/" ? "Nothing in here yet" : "This folder is empty"}
              body={
                <>
                  Files you put here are written to your own drive, encrypted, and stored once however many devices send the same one. Nothing is copied
                  to anyone else&apos;s computer.
                </>
              }
              action={
                <>
                  <Button kind="primary" className="px-4 py-2" onClick={() => input.current?.click()}>
                    <IconUpload size={16} />
                    Upload a file
                  </Button>
                  <span className="text-[13px] text-ash">
                    or run <code className="font-mono text-[12px]">woven-backup</code> on another Mac
                  </span>
                </>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink/6" data-testid="listing">
            {listing.folders.map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <button type="button" onClick={() => setPath(f.path)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-bone font-mono text-[11px] text-ash">▸</span>
                  <span className="truncate text-[14px] font-medium">{f.name}</span>
                </button>
                <span className="text-[12px] text-ash">
                  {f.items} {f.items === 1 ? "item" : "items"} · {bytes(f.bytes)}
                </span>
              </li>
            ))}
            {listing.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0" data-testid="file">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-bone font-mono text-[10px] uppercase text-ash">{(f.mime ?? "file").split("/")[1]?.slice(0, 4) ?? "file"}</span>
                  <div className="min-w-0">
                    <a
                      href={files.contentUrl(f.id)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (isRemoteUrl(files.contentUrl(f.id))) {
                          e.preventDefault();
                          openCoreUrl(files.contentUrl(f.id)).catch((err: unknown) => say(explainAction(err)));
                        }
                      }}
                      className="block truncate text-[14px] font-medium hover:underline"
                    >
                      {f.name}
                    </a>
                    <div className="text-[12px] text-ash">
                      {bytes(f.size)} · {new Date(f.modifiedAt).toLocaleDateString()}
                      {f.source && f.source !== "dashboard" ? ` · from ${f.source.replace("backup:", "")}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <a
                    href={files.contentUrl(f.id, true)}
                    aria-label={`Save ${f.name}`}
                    title="Save a copy"
                    onClick={(e) => {
                      if (isRemoteUrl(files.contentUrl(f.id, true))) {
                        e.preventDefault();
                        openCoreUrl(files.contentUrl(f.id, true), { download: f.name }).catch((err: unknown) => say(explainAction(err)));
                      }
                    }}
                    className="tap rounded-[8px] p-1.5 text-ash hover:bg-bone hover:text-ink"
                  >
                    <IconDownload size={18} />
                  </a>
                  <Menu
                    label={`More for ${f.name}`}
                    items={[
                      { label: "Rename", onClick: () => setRename({ file: f, name: f.name }) },
                      { label: "Share with the house", onClick: () => setShare(f) },
                      { label: "Make a link", onClick: () => setLink({ file: f, hours: 24 * 7, made: null }) },
                      { label: "Delete", onClick: () => remove(f), danger: true },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {links.some((l) => l.live) && (
        <Card title="Links you handed out" className="mt-4">
          <ul className="divide-y divide-ink/6" data-testid="share-links">
            {links
              .filter((l) => l.live)
              .map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="text-[12px] text-ash">
                      Ends {new Date(l.expiresAt).toLocaleString()} · {l.downloads} {l.downloads === 1 ? "download" : "downloads"}
                      {l.maxDownloads ? ` of ${l.maxDownloads}` : ""}
                    </div>
                  </div>
                  <Button kind="quiet" onClick={() => revokeLink(l)}>
                    Turn off
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {summary && summary.sources.length > 0 && (
        <Card title="Where files came from" className="mt-4">
          <ul className="divide-y divide-ink/6">
            {summary.sources.map((s) => (
              <li key={s.source} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 text-[14px]">
                <span className="font-medium">{s.source === "dashboard" ? "Uploaded here" : s.source === "import" ? "Imported on the box" : s.source.replace("backup:", "Backup from ")}</span>
                <span className="text-[13px] text-ash">
                  {s.items} items · {bytes(s.bytes)} · <Pill tone="good">{new Date(s.lastAt).toLocaleDateString()}</Pill>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={share !== null} onClose={() => setShare(null)} kicker="Who can see it" title={`Move ${share?.name ?? ""}`}>
        <ul className="mt-3 divide-y divide-ink/6">
          {visible.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-[12px] text-ash">{s.hint}</div>
              </div>
              <Button kind={share?.namespace === s.id ? "soft" : "outline"} disabled={share?.namespace === s.id} onClick={() => doShare(s.id)}>
                {share?.namespace === s.id ? "Here now" : "Move here"}
              </Button>
            </li>
          ))}
        </ul>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setShare(null)} data-autofocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={link !== null} onClose={() => setLink(null)} kicker="A link anyone can open, until it ends" title={link?.file.name ?? ""} size="md">
        {link && !link.made ? (
          <>
            <p className="mt-2 text-[14px] text-ash">Whoever has the link can download this one file from your Core. Nothing else on the box is reachable through it, and every download leaves a receipt.</p>
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="How long the link lasts">
              {[
                [24, "1 day"],
                [24 * 7, "1 week"],
                [24 * 30, "30 days"],
              ].map(([h, label]) => (
                <Button key={h} kind={link.hours === h ? "soft" : "outline"} onClick={() => setLink({ ...link, hours: h as number })} role="radio" aria-checked={link.hours === h}>
                  {label}
                </Button>
              ))}
            </div>
            <DialogActions>
              <Button kind="primary" className="flex-1 py-2.5" onClick={makeLink} data-autofocus data-testid="make-link">
                Make the link
              </Button>
              <Button kind="soft" className="flex-1 py-2.5" onClick={() => setLink(null)}>
                Cancel
              </Button>
            </DialogActions>
          </>
        ) : link?.made ? (
          <>
            <input readOnly value={link.made.url} onFocus={(e) => e.target.select()} className="mt-4 w-full rounded-[8px] bg-bone px-3 py-2 font-mono text-[12px] ring-1 ring-ink/8" aria-label="Share link" data-testid="share-url" />
            <p className="mt-2 text-[13px] text-ash">Ends {new Date(link.made.share.expiresAt).toLocaleString()}. Turn it off any time from the list below the files.</p>
            <DialogActions>
              <Button kind="primary" className="flex-1 py-2.5" onClick={copyLink} data-autofocus>
                Copy link
              </Button>
              <Button kind="soft" className="flex-1 py-2.5" onClick={() => setLink(null)}>
                Done
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      <Dialog open={rename !== null} onClose={() => setRename(null)} kicker="Rename" title={rename?.file.name ?? ""}>
        <input className="mt-4 w-full rounded-[8px] bg-bone px-3 py-2 text-[14px] ring-1 ring-ink/8" value={rename?.name ?? ""} onChange={(e) => setRename((r) => (r ? { ...r, name: e.target.value } : r))} data-autofocus />
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={doRename}>
            Rename
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setRename(null)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
