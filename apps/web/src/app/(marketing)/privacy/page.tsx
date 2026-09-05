import type { Metadata } from "next";
import Link from "next/link";
import { Feature } from "@/components/feature";
import { PrivacyPanel } from "@/components/privacy-panel";
import { Reveal } from "@/components/reveal";
import { ScreenActivity } from "@/components/screen";
import { Section } from "@/components/section";
import { TwoSides } from "@/components/two-sides";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Where your data goes, and doesn't. Voice, home, cameras, files and memory stay inside. Anything that crosses the Gate asks first and is recorded.",
};

const promises = [
  {
    title: "Four things never leave.",
    body: "Voice, home control, cameras and your files, photos and memory are processed on the box. These categories are pinned to Inside in the software, not in a settings page.",
  },
  {
    title: "Everything else asks first.",
    body: "A crossing is a card you approve. It names the task and exactly what will be sent. Approve once, or keep it inside and let Tandem do its best from what it already knows.",
  },
  {
    title: "Every crossing is written down.",
    body: "The front screen and the app keep a log: time, task, what left, who approved it. Tap any line for the full record. Nothing is summarised away.",
  },
  {
    title: "One tap stops all of it.",
    body: "Close the Gate from the screen, the app, or by voice. The box keeps working. Jobs that need the Outside wait or fail clearly. Nothing is silently queued.",
  },
];

const security = [
  ["Secure element + TPM 2.0", "Per-device identity. Keys never leave the box."],
  ["Encrypted at rest", "Household storage unlocks only for an attested compute module."],
  ["Signed A/B updates", "Every update is signed and can roll back on its own."],
  ["No inbound ports", "Remote access is an outbound, mutually authenticated tunnel."],
  ["Locked debug", "Production debug ports are disabled. Service access is audited."],
  ["Disclosure program", "A published security contact, severity SLAs, and a support window."],
];

export default function PrivacyPage() {
  return (
    <>
      <Section
        theme="light"
        titleAs="h1"
        eyebrow="Privacy"
        title="Where your data goes, and doesn't."
        subtitle="This is the Privacy tab from the app. Four categories are pinned to Inside. Move the other two and watch the week change."
        primary={{ label: "Reserve a Core", href: "/order" }}
        secondary={{ label: "Meet Tandem", href: "/tandem" }}
      >
        <PrivacyPanel />
      </Section>

      <section data-theme="white" className="bg-white text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
            {promises.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05}>
                <h2 className="font-display text-[26px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[30px]">
                  {p.title}
                </h2>
                <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-ash">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Section
        id="gate"
        theme="dark"
        eyebrow="How it is built"
        title="Two computers. One Gate."
        subtitle="Privacy here is not a setting. The Inside, where everything of yours lives, has no route to the internet. The Outside is your router, on its own processor. The Gate between them forwards only what you approve, and writes it down."
      >
        <TwoSides />
      </Section>

      <Feature
        theme="dark"
        eyebrow="Anatomy of a crossing"
        title="What actually leaves the house."
        body={
          <>
            <p>
              A crossing is a task, not a transcript. Tandem builds the smallest package that
              can answer the question, strips names, identifiers and history, and shows you
              the package before it goes.
            </p>
            <p>The answer comes back through Tandem. Any action it implies still passes the
              permission engine and is verified on the device.</p>
          </>
        }
        points={[
          "Task text, written by Tandem, not your raw words",
          "Minimal context: the fields the task needs and nothing else",
          "No household names, files, photos, device names or history",
          "Provider, model and time recorded in the receipt",
        ]}
        link={{ label: "How Tandem decides", href: "/tandem" }}
      >
        <ScreenActivity className="max-w-[560px]" />
      </Feature>

      <section data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash">Security</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              Built to the consumer IoT baseline, then past it.
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash">
              Woven Core maps its controls to the NIST consumer IoT baseline and the 2026
              manufacturer guidance. The model is never a security boundary.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {security.map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.04}>
                <div className="hairline border-t pt-4">
                  <div className="font-display text-[18px] font-medium tracking-[-0.01em]">{t}</div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ash">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section data-theme="white" className="bg-white text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash">How we talk about it</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              Inside first. Not &ldquo;everything stays inside.&rdquo;
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="rounded-[14px] bg-bone p-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-local">We say</div>
                <ul className="mt-3 space-y-2 text-[15px]">
                  <li>Inside first. A crossing when needed and permitted.</li>
                  <li>Here is exactly what is stored on Core and what is in Woven Cloud.</li>
                  <li>Measured inside share, shown on your screen.</li>
                  <li>A published security support period and end-of-life policy.</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="rounded-[14px] bg-bone p-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash">We do not say</div>
                <ul className="mt-3 space-y-2 text-[15px] text-ash">
                  <li>&ldquo;Fully private.&rdquo;</li>
                  <li>&ldquo;No cloud, ever.&rdquo;</li>
                  <li>&ldquo;Runs a 70B model&rdquo; as if it were a permanent feature.</li>
                  <li>Anything a lawyer would not let us put on the box.</li>
                </ul>
              </div>
            </Reveal>
          </div>
          <p className="mt-8 max-w-[640px] text-[13px] leading-relaxed text-ash">
            Every performance, privacy and security claim on this site has an owner, evidence
            and a review date. Prototype targets are labelled as targets.
          </p>
        </div>
      </section>

      <section
        data-theme="dark"
        className="flex min-h-[60svh] flex-col items-center justify-center bg-graphite px-6 py-24 text-center text-bone"
      >
        <Reveal>
          <span className="orb mx-auto block" style={{ ["--orb" as string]: "14px" }} />
          <h2 className="mt-12 font-display text-[36px] font-medium tracking-[-0.02em] md:text-[44px]">
            Privacy you can glance at.
          </h2>
          <p className="mt-2 text-[15px] text-ash-2">From the kitchen, on the front of the box.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link href="/order" className="btn btn-primary">
              Reserve
            </Link>
            <Link href="/legal" className="btn btn-secondary">
              Privacy policy
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
