"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { search, type SearchResult } from "@/lib/core/files";
import { roomIcon, type RoomHref, IconSearch } from "./icons";

/**
 * Search on the box (gap 18), and the way around it (design phase 23).
 *
 * Two things people want from a box at the top of a window: find my thing,
 * and take me to that room. Splitting those into a search field and a
 * separate command palette means learning two surfaces and guessing which
 * one you are in. This is one field: rooms whose names match come first,
 * because navigating is instant and searching is not, and everything the
 * Core's index knows follows underneath.
 *
 * Nothing leaves the house for a search. The index is on the Core, which is
 * also why it keeps working with the Gate closed.
 */

const rooms: { href: RoomHref; label: string; hint: string }[] = [
  { href: "/dashboard", label: "Overview", hint: "The whole house" },
  { href: "/dashboard/ask", label: "Ask", hint: "Answers from the box" },
  { href: "/dashboard/files", label: "Files", hint: "Everything you put in" },
  { href: "/dashboard/photos", label: "Photos", hint: "Indexed on the box" },
  { href: "/dashboard/tv", label: "TV", hint: "Your own library" },
  { href: "/dashboard/home", label: "Home", hint: "Lights, plugs and locks" },
  { href: "/dashboard/cameras", label: "Cameras", hint: "Detection on the box" },
  { href: "/dashboard/network", label: "Network", hint: "The two networks and the Gate" },
  { href: "/dashboard/activity", label: "Activity", hint: "Every receipt" },
  { href: "/dashboard/privacy", label: "Privacy", hint: "Counted from the ledger" },
  { href: "/dashboard/agents", label: "Agents", hint: "What runs on the box" },
  { href: "/dashboard/core", label: "Core", hint: "The machine and the switch" },
  { href: "/dashboard/settings", label: "Settings", hint: "People, keys and backups" },
];

const kindLabel = { file: "File", memory: "Memory", routine: "Routine" } as const;

type Item = { key: string; href: string; title: string; detail: string; tag: string; room?: RoomHref };

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      search(q.trim())
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* One shortcut, the one every other app has trained people to reach for. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        field.current?.focus();
        field.current?.select();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim().toLowerCase();
  const matchedRooms: Item[] = term
    ? rooms
        .filter((r) => r.label.toLowerCase().startsWith(term) || r.hint.toLowerCase().includes(term))
        .slice(0, 3)
        .map((r) => ({ key: `room-${r.href}`, href: r.href, title: r.label, detail: r.hint, tag: "Go", room: r.href }))
    : [];

  const found: Item[] = (results ?? []).map((r) => ({
    key: `${r.kind}-${r.id}`,
    href: r.href,
    title: r.title,
    detail: r.snippet.replace(/[[\]]/g, ""),
    tag: `${kindLabel[r.kind]}${r.namespace ? ` · ${r.namespace}` : ""}`,
  }));

  const items = [...matchedRooms, ...found];
  // The highlight can outlive a shorter result list; clamp rather than reset
  // from an effect, which would cascade a render on every keystroke.
  const highlighted = items.length === 0 ? 0 : Math.min(active, items.length - 1);

  const choose = (item: Item) => {
    setOpen(false);
    setQ("");
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (q) setQ("");
      else setOpen(false);
      return;
    }
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      const item = items[highlighted];
      if (item) {
        e.preventDefault();
        choose(item);
      }
    }
  };

  return (
    <div ref={box} className="relative hidden md:block">
      <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ash" />
      <input
        ref={field}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search the box…"
        aria-label="Search the box"
        role="combobox"
        aria-expanded={open && !!q.trim()}
        aria-controls="search-results"
        autoComplete="off"
        data-testid="search-box"
        className="tap w-[240px] rounded-[8px] bg-white py-1.5 pl-8 pr-10 text-[13px] ring-1 ring-ink/8 placeholder:text-ash focus:outline-none focus:ring-ink/25"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] bg-bone px-1.5 py-0.5 font-mono text-[10px] text-ash"
      >
        ⌘K
      </kbd>

      {open && q.trim() && (
        <div
          id="search-results"
          role="listbox"
          className="dash-panel absolute right-0 top-full z-40 mt-1 w-[380px] rounded-[12px] bg-white p-1.5 shadow-[var(--shadow-pop)] ring-1 ring-ink/10"
          data-testid="search-results"
        >
          {items.length === 0 && results === null ? (
            <div className="px-3 py-2 text-[13px] text-ash">Looking on the box…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-[13px] leading-relaxed text-ash">
              Nothing on the box is called that. Search reads names, paths, memories and routines; not inside documents yet.
            </div>
          ) : (
            <ul>
              {items.map((item, i) => {
                const Glyph = item.room ? roomIcon[item.room] : null;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      role="option"
                      aria-selected={i === highlighted}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                      }}
                      className={`block rounded-[8px] px-3 py-2 ${i === highlighted ? "bg-bone" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          {Glyph && <Glyph size={15} className="shrink-0 text-ash" />}
                          <span className="truncate font-medium">{item.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">{item.tag}</span>
                      </div>
                      <div className="truncate pl-[22px] text-[12px] text-ash">{item.detail}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
