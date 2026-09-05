"use client";

import { useState } from "react";
import { Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { photoStats } from "@/lib/dashboard/data";

/**
 * Placeholder tiles stand in for the photo grid until the backend serves
 * thumbnails. Tones mix the palette so they read as designed in both
 * colour schemes.
 */
const tones = [72, 55, 88, 40, 80, 62, 95, 46, 68].map((pct) => `color-mix(in srgb, var(--color-chassis-2) ${pct}%, var(--color-bone))`);

const albums = [
  ["Lake trip", "July 2026", 38],
  ["Maya's birthday", "May 2026", 112],
  ["Garden", "This spring", 64],
  ["Front door events", "Last 30 days", 21],
] as const;

const peopleGroups = [
  ["Maya", 4_812],
  ["Alex", 3_960],
  ["Sam", 3_311],
  ["Grandma Rose", 940],
  ["Priya", 388],
  ["Theo", 212],
  ["Coach Dan", 96],
  ["7 more", 1_480],
] as const;

const placeGroups = [
  ["Home · Tampa", 31_204],
  ["Lake Kissimmee", 1_866],
  ["St Pete beach", 1_420],
  ["School", 902],
  ["Grandma's house", 611],
  ["Orlando", 388],
  ["56 more", 3_402],
] as const;

const dateGroups = [
  ["This week", 312],
  ["August 2026", 1_204],
  ["July 2026", 2_611],
  ["June 2026", 1_990],
  ["Spring 2026", 4_102],
  ["2025", 12_884],
  ["2024 and earlier", 25_107],
] as const;

type Filter = "people" | "places" | "dates";

const filters: { id: Filter; label: string }[] = [
  { id: "people", label: "People" },
  { id: "places", label: "Places" },
  { id: "dates", label: "Dates" },
];

export function PhotosView() {
  const [filter, setFilter] = useState<Filter | null>(null);
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? null : f));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Photos"
        sub={`${photoStats.total.toLocaleString()} photos · ${photoStats.newThisWeek} new this week · indexed on the box by faces, places and dates`}
        action={
          <div className="flex gap-2" role="group" aria-label="Browse by">
            {filters.map((f) => {
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f.id)}
                  className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    on ? "bg-ink text-bone" : "bg-white text-ink ring-1 ring-ink/8 hover:ring-ink/20"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-[13px] text-ash">People</div>
          <div className="mt-1 font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{photoStats.people}</div>
          <div className="mt-1.5 text-[12px] text-ash">Recognised on the box. Never uploaded.</div>
        </Card>
        <Card>
          <div className="text-[13px] text-ash">Places</div>
          <div className="mt-1 font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{photoStats.places}</div>
          <div className="mt-1.5 text-[12px] text-ash">From photo metadata, kept inside.</div>
        </Card>
        <Card>
          <div className="text-[13px] text-ash">Indexed</div>
          <div className="mt-1 font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{photoStats.indexed}</div>
          <div className="mt-1.5 text-[12px] text-ash">Search by what is in them.</div>
        </Card>
      </div>

      {filter === null && (
        <Card title="Albums" className="mt-4">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {albums.map(([name, when, count], i) => (
              <li key={name} className="overflow-hidden rounded-[12px] ring-1 ring-ink/5">
                <div className="grid aspect-[4/3] grid-cols-3 gap-[2px] bg-bone">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} style={{ background: tones[(i * 3 + j) % tones.length] }} />
                  ))}
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <div className="text-[14px] font-medium">{name}</div>
                    <div className="text-[12px] text-ash">{when}</div>
                  </div>
                  <Pill>{count}</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {filter === "people" && (
        <Card title={`People · ${photoStats.people} recognised`} className="mt-4">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {peopleGroups.map(([name, count], i) => (
              <li key={name} className="flex items-center gap-3 rounded-[12px] bg-bone px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-medium text-ink" style={{ background: tones[(i * 2) % tones.length] }}>
                  {name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{name}</div>
                  <div className="text-[12px] text-ash">{count.toLocaleString()} photos</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ash">Faces are matched on the box and named by you. Nothing about who is in a photo leaves it.</p>
        </Card>
      )}

      {filter === "places" && (
        <Card title={`Places · ${photoStats.places}`} className="mt-4">
          <ul className="divide-y divide-ink/6">
            {placeGroups.map(([name, count], i) => (
              <li key={name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex items-center gap-3">
                  <span className="block h-6 w-9 rounded-[4px]" style={{ background: tones[(i * 4 + 1) % tones.length] }} />
                  <span className="text-[14px] font-medium">{name}</span>
                </span>
                <span className="font-mono text-[12px] text-ash">{count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {filter === "dates" && (
        <Card title="Dates" className="mt-4">
          <ul className="divide-y divide-ink/6">
            {dateGroups.map(([name, count]) => {
              const share = Math.max(2, Math.round((count / photoStats.total) * 100));
              return (
                <li key={name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[180px_1fr_auto]">
                  <span className="text-[14px] font-medium">{name}</span>
                  <span className="hidden h-[6px] overflow-hidden rounded-full bg-bone sm:block">
                    <span className="block h-full rounded-full bg-amber" style={{ width: `${share}%` }} />
                  </span>
                  <span className="font-mono text-[12px] text-ash">{count.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={filter ? `This week · ${photoStats.newThisWeek} new` : "This week"} className="mt-4">
        <div className="grid grid-cols-4 gap-[3px] sm:grid-cols-6 lg:grid-cols-9">
          {Array.from({ length: 27 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[4px]" style={{ background: tones[(i * 7) % tones.length] }} />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ash">Thumbnails render from the box&apos;s own index once a Core is connected.</p>
      </Card>
    </div>
  );
}
