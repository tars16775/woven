"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Routine } from "@woven/schema";
import { Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { routines as routinesApi } from "@/lib/core/actions";
import { explainAction } from "@/lib/core/actions";
import { RoomNote } from "@/components/dashboard/room-note";

/**
 * The honest Agents page (gap 10). This Core has no agent runtime yet:
 * nothing runs on its own identity, installs itself or holds credentials.
 * What does run on the box today is listed instead: routines, which act
 * with their author's permissions, and Ask, which is rules over the
 * household's own data. When the runtime lands this page fills in.
 */
export function AgentsLive() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    routinesApi
      .list()
      .then((r) => alive && setRoutines(r))
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Agents"
        sub="Nothing runs on its own identity on this Core yet."
        action={
          <Pill tone="neutral">
            <span data-testid="agents-none">No agent runtime yet</span>
          </Pill>
        }
      />

      <RoomNote id="room:agents" />

      <Card title="What this means">
        <p className="text-[14px] leading-relaxed">
          An agent, in Woven&apos;s sense, is software that runs in its own sandbox with its own identity and credentials scoped to what you granted, and that leaves a receipt for every action. That runtime is not on this
          Core yet, so there is nothing here to install, pause or revoke. Anything that says otherwise on this screen would be made up.
        </p>
        <ul className="mt-4 grid gap-3 text-[14px] md:grid-cols-2">
          {[
            "Nothing on this box acts on its own identity. Every action is a person's, or a routine acting with its author's permissions.",
            "Ask answers by rules over the household's own data and never crosses the Gate for a question.",
            "The permission engine, the receipts and the Gate are already in place; agents will run inside them when they arrive.",
            "Until then this page will not show numbers it does not have.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        className="mt-4"
        title="What does run on the box"
        action={
          <Link href="/dashboard/home" className="text-[13px] font-medium text-ash hover:text-ink">
            Routines live in Home
          </Link>
        }
      >
        {error ? (
          <p role="alert" className="text-[13px] text-ask">
            {error}
          </p>
        ) : routines === null ? (
          <p className="text-[13px] text-ash">Loading…</p>
        ) : routines.length === 0 ? (
          <p className="text-[14px] text-ash">No routines yet. Make one from Home; it runs on the box with your permissions and leaves receipts in Activity.</p>
        ) : (
          <ul className="divide-y divide-ink/6" data-testid="agents-routines">
            {routines.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="mt-0.5 text-[12px] text-ash">
                    {r.steps.length} {r.steps.length === 1 ? "step" : "steps"} · {r.lastRunAt ? `last ran ${new Date(r.lastRunAt).toLocaleString()}` : "never run"}
                    {r.lastResult ? ` · ${r.lastResult}` : ""}
                  </div>
                </div>
                <Pill tone={r.enabled ? "good" : "neutral"}>{r.enabled ? "on" : "off"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
