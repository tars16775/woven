"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { search, type SearchResult } from "@/lib/core/files";

/**
 * Search on the box (gap 18): file names and paths, memories and routines
 * from the Core's index, filtered by what the signed-in person may see.
 * Nothing leaves the house for a search.
 */
export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  const kindLabel = { file: "File", memory: "Memory", routine: "Routine" } as const;

  return (
    <div ref={box} className="relative hidden md:block">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search the box…"
        aria-label="Search the box"
        data-testid="search-box"
        className="w-[220px] rounded-[8px] bg-white px-3 py-1.5 text-[13px] ring-1 ring-ink/8 placeholder:text-ash focus:ring-ink/25 focus:outline-none"
      />
      {open && q.trim() && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[360px] rounded-[12px] bg-white p-1.5 shadow-lg ring-1 ring-ink/10" data-testid="search-results">
          {results === null ? (
            <div className="px-3 py-2 text-[13px] text-ash">Looking on the box…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-ash">Nothing on the box is called that. Search reads names, paths, memories and routines; not inside documents yet.</div>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <Link
                    href={r.href}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                    }}
                    className="block rounded-[8px] px-3 py-2 hover:bg-bone"
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
                        {kindLabel[r.kind]}
                        {r.namespace ? ` · ${r.namespace}` : ""}
                      </span>
                    </div>
                    <div className="truncate text-[12px] text-ash">{r.snippet.replace(/[[\]]/g, "")}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
