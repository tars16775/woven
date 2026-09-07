"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth";
import { useGuide } from "@/lib/dashboard/guide";
import { Button } from "./ui";
import { IconX } from "./icons";

/**
 * The first thing a new household sees (phase 6).
 *
 * A house that has just been created has nothing in it, and every room will
 * be empty. Rather than let a person walk into six empty rooms and conclude
 * the software is broken, this says what just happened, what is already true,
 * and where to start. It appears once per person and can be dismissed at any
 * point; it is not a modal, because a modal on arrival is a toll booth.
 */
export function Welcome({ onStartTour }: { onStartTour: () => void }) {
  const session = useSession();
  const { show, dismiss } = useGuide("welcome");
  if (!show) return null;

  const first = session?.name?.split(" ")[0] ?? "there";

  return (
    <section
      className="dash-lock relative overflow-hidden rounded-[20px] bg-graphite p-6 text-bone ring-1 ring-white/8 md:p-8"
      aria-labelledby="welcome-title"
    >
      {/* The light, sitting behind the words rather than on top of them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(232,184,90,0.35) 0%, transparent 70%)" }}
      />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the welcome"
        className="tap absolute right-4 top-4 rounded-full p-1.5 text-ash-2 hover:bg-white/10 hover:text-bone"
      >
        <IconX size={16} />
      </button>

      <div className="relative max-w-[62ch]">
        <span className="orb" style={{ ["--orb" as string]: "12px" }} />
        <h2 id="welcome-title" className="mt-5 font-display text-[28px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[34px]">
          Your house is running, {first}.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ash-2">
          Everything from here on lives on your Core and nowhere else. It is empty today, which is what an honest new house looks like: no sample
          photos, no pretend devices, no numbers borrowed from anyone. The rooms fill up as you put things in them.
        </p>

        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Put something in", "Upload a file or import a folder, and Files stops being empty."],
            ["Look at the record", "Every consequential act writes a receipt. Activity already has a few."],
            ["Decide what crosses", "The Gate asks before anything leaves. You answer, every time."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[11px]">{i + 1}</span>
              <span>
                <span className="block text-[14px] font-medium">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-ash-2">{body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Button
            kind="primary"
            className="px-4 py-2"
            onClick={() => {
              onStartTour();
            }}
          >
            Show me around
          </Button>
          <Link href="/dashboard/files" onClick={dismiss} className="tap rounded-[8px] bg-white/10 px-4 py-2 text-[13px] font-medium text-bone hover:bg-white/16">
            Put something in
          </Link>
          <button type="button" onClick={dismiss} className="tap rounded-[8px] px-3 py-2 text-[13px] font-medium text-ash-2 hover:text-bone">
            I will find my way
          </button>
        </div>
      </div>
    </section>
  );
}
