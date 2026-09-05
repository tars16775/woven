import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Founding Homes",
  description:
    "Fifty households run Woven OS on off-the-shelf boxes before any chassis is tooled. Hardware at cost, a direct line to the team, and a say in what ships.",
};

const plan = [
  ["Pilot", "Q4 2026", "Fifty homes on off-the-shelf unified-memory boxes. Target: plug in to first answer in under two minutes."],
  ["Pre-orders", "Q1 2027", "Core+ and Pro on reference boards in the first chassis. Five hundred paid pre-orders before any mould is cut."],
  ["Ship v1", "Q3 2027", "One thousand units. Files, photos, media, home, cameras and Gate crossings at launch."],
  ["Modules and robots", "2028", "Second-generation compute module, robot API with the first partners, then the wider app."],
];

const gets = [
  "A Woven box at cost, yours to keep if you stay through the pilot",
  "Gate crossings free for the pilot, and a year after",
  "A direct channel to the engineers, with a named person",
  "Your name on the wall inside the first thousand boxes, if you want it",
];

const asks = [
  "Use it daily for six weeks as your actual home box",
  "Three connected-device categories in the house, or willingness to add them",
  "Two interviews and a short exit conversation",
  "Telemetry you can read and switch off, with explicit consent",
];

export default function FoundingHomesPage() {
  return (
    <>
      <Section
        theme="light"
        titleAs="h1"
        eyebrow="Founding Homes · Q4 2026"
        title="Fifty households go first."
        subtitle="Woven OS on off-the-shelf boxes, in real homes, before any chassis is tooled. You get the hardware at cost and a say in what ships. We get the truth."
        primary={{ label: "Apply", href: "#apply" }}
        secondary={{ label: "Read the plan", href: "#plan" }}
      >
        <div className="flex flex-col items-center">
          <span className="orb" style={{ ["--orb" as string]: "16px" }} />
          <p className="mt-16 font-mono text-[12px] uppercase tracking-[0.2em] text-ash">
            50 homes · 6 weeks · at cost
          </p>
        </div>
      </Section>

      <section data-theme="white" className="bg-white text-ink">
        <div className="mx-auto grid max-w-[1100px] gap-12 px-6 py-24 md:grid-cols-2 lg:px-10">
          <Reveal>
            <h2 className="font-display text-[28px] font-medium tracking-[-0.02em]">What you get</h2>
            <ul className="mt-5 space-y-3 text-[15px]">
              {gets.map((g) => (
                <li key={g} className="flex items-start gap-3">
                  <span className="mt-[8px] block h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display text-[28px] font-medium tracking-[-0.02em]">What we ask</h2>
            <ul className="mt-5 space-y-3 text-[15px]">
              {asks.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <span className="mt-[8px] block h-[6px] w-[6px] shrink-0 rounded-full bg-ink/30" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* The plan is a timeline, so the sequence is the content */}
      <section id="plan" data-theme="dark" className="bg-graphite text-bone">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash-2">The plan</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              Software first, then steel. Every hardware step is gated by demand.
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {plan.map(([name, when, detail], i) => (
              <Reveal key={name} delay={i * 0.05}>
                <li className="border-t border-white/12 pt-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-2">
                    {when}
                  </div>
                  <div className="mt-2 font-display text-[22px] font-medium tracking-[-0.01em]">
                    {name}
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ash-2">{detail}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="apply" data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <Reveal>
              <p className="text-[13px] font-medium text-ash">Apply</p>
              <h2 className="mt-2 font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
                Tell us about the house.
              </h2>
              <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-ash">
                We are choosing for variety: apartments and houses, families and singles,
                Home Assistant veterans and people who have never opened a terminal. Honest
                answers help more than impressive ones.
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <ApplyForm />
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
