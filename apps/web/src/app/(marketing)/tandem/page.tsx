import type { Metadata } from "next";
import Link from "next/link";
import { AskDemo } from "@/components/ask-demo";
import { Feature } from "@/components/feature";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { ClaimTag, Fn, Footnotes } from "@/components/claim";
import type { ClaimId } from "@/lib/claims";

export const metadata: Metadata = {
  title: "Tandem",
  description:
    "Tandem is the household assistant that runs inside Woven Core. It answers from your files, photos, calendar and home, and asks before anything crosses the Gate.",
};

const lifecycle = [
  ["Ask", "Text or voice, from any room."],
  ["Understand", "Typed intent, with a confidence score."],
  ["Retrieve", "Only the context this person is allowed to see."],
  ["Plan", "Steps, tools, and any irreversible side effects, named."],
  ["Check", "A deterministic policy engine decides, not the model."],
  ["Approve", "Sensitive steps become a card you can read."],
  ["Execute", "Idempotent, bounded retries, timeouts."],
  ["Verify", "Read the device back. A 200 is not a locked door."],
  ["Receipt", "Who, what, where it ran, what it sent."],
];

const risk = [
  ["A", "Read a temperature", "Automatic"],
  ["B", "Lights, media", "Automatic"],
  ["C", "Thermostat within bounds", "Automatic within bounds"],
  ["D", "Unlock a door, disarm", "Presence or approval"],
  ["E", "Place an order", "Approval above your limit"],
  ["F", "Move money", "Not supported"],
  ["G", "Robot uses a dangerous tool", "Not supported"],
  ["H", "Keys, ownership, factory reset", "Strong auth"],
];

const routing = [
  ["Wake word, speech", "Inside", "No always-on audio leaves the house."],
  ["Home control", "Inside", "Works with the internet unplugged."],
  ["Files, photos, memory", "Inside", "Indexed and searched on the box."],
  ["Summaries, planning", "Inside first", "Crosses the Gate only if policy allows and you say so."],
  ["Deep research", "Crosses the Gate, by permission", "Minimal context, recorded."],
  ["Video generation", "Crosses the Gate, by permission", "Outside everyday use."],
];

/** The notes at the foot of this page, in the order their markers appear. */
const notes = ["tandem", "speed", "voice", "gate", "receipts", "agents", "insideShare"] as const satisfies readonly ClaimId[];

export default function TandemPage() {
  return (
    <>
      <Section
        theme="dark"
        titleAs="h1"
        eyebrow="Tandem"
        tag={<ClaimTag id="tandem" />}
        title="Ask. It stays home."
        subtitle={
          <>
            A household assistant that runs inside. It knows your calendar, files, photos and home,
            answers in under a second
            <Fn notes={notes} id="speed" />, and asks before anything crosses the Gate. Try it: give
            the approval yourself.
          </>
        }
        primary={{ label: "Reserve a Core", href: "/order" }}
        secondary={{ label: "See what leaves", href: "/privacy" }}
        foot={
          <>
            The demonstration above is scripted. On a Core today the assistant answers by rules over
            what the box holds and says so on the screen; the model that reads a sentence, and the
            voice that speaks to it, need the box.
            <Fn notes={notes} id="tandem" />
            <Fn notes={notes} id="voice" />
          </>
        }
      >
        <AskDemo />
      </Section>

      <Feature
        theme="white"
        eyebrow="Context"
        title="It knows the household, not the internet."
        body={
          <>
            <p>
              Tandem reads what is on the box: the shared calendar, each person&apos;s files
              and photos, device state, routines, and the memories you have chosen to keep.
              It does not need a search engine to tell you when the dentist is.
            </p>
            <p>
              Every person has their own namespace. Maya&apos;s notes are not Sam&apos;s
              context, and a guest sees only the lights they were given.
            </p>
          </>
        }
        points={[
          "Per-person memory you can read, edit and delete",
          "Household, private, security and guest namespaces",
          "No implicit sharing between people or between work and home",
          "Provenance on every answer: which calendar, which file",
        ]}
      >
        <div className="grid w-full max-w-[520px] grid-cols-2 gap-3">
          {[
            ["Calendar", "Shared · 3 people"],
            ["Files", "1.2 TB · 3 devices"],
            ["Photos", "48,210 · indexed"],
            ["Home", "24 devices · 6 rooms"],
            ["Memory", "Per person · editable"],
            ["Cameras", "4 live · inside"],
          ].map(([name, meta]) => (
            <div key={name} className="rounded-[12px] bg-bone px-5 py-5 ring-1 ring-ink/5">
              <div className="text-[15px] font-medium">{name}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                {meta}
              </div>
            </div>
          ))}
        </div>
      </Feature>

      {/* Lifecycle: a real sequence, so the numbers carry meaning */}
      <section data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="flex flex-wrap items-center gap-2.5 text-[13px] font-medium text-ash">
              How an action happens
              <ClaimTag id="receipts" />
            </p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              The model suggests. The policy decides. The device confirms.
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash">
              Tandem is an orchestrator, not a single model with a key to the house. Every
              request that could change something passes through the same nine steps. This part is
              built and running today: the permission engine, the approvals bound to the exact
              parameters, and the receipt at the end.
              <Fn notes={notes} id="receipts" />
            </p>
          </Reveal>
          <ol className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {lifecycle.map(([name, detail], i) => (
              <li key={name} className="hairline border-t pt-4">
                <Reveal delay={i * 0.04}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-amber">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[20px] font-medium tracking-[-0.01em]">
                      {name}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ash">{detail}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Risk classes */}
      <section data-theme="white" className="bg-white text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="flex flex-wrap items-center gap-2.5 text-[13px] font-medium text-ash">
              Permissions
              <ClaimTag id="gate" />
            </p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              Eight classes of action. You set the line.
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash">
              Built and running. The engine is a pure function of the request: same request, same
              answer, every time, and five thousand random requests are checked against these rules
              on every change.
              <Fn notes={notes} id="gate" />
            </p>
          </Reveal>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="hairline border-b text-left text-ash">
                  <th className="w-12 pb-3 font-normal">Class</th>
                  <th className="pb-3 font-normal">For example</th>
                  <th className="pb-3 font-normal">Default</th>
                </tr>
              </thead>
              <tbody>
                {risk.map(([c, ex, d]) => (
                  <tr key={c} className="hairline border-b">
                    <td className="py-3 font-mono text-[13px] text-amber">{c}</td>
                    <td className="py-3">{ex}</td>
                    <td className="py-3 text-ash">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[560px] text-[13px] text-ash">
            Classes F and G are not supported in the first release by design. Money moves
            through your bank, and robots keep their own safety controls.
          </p>
        </div>
      </section>

      {/* Agents */}
      <Feature
        id="agents"
        theme="dark"
        eyebrow="Agents"
        tag={<ClaimTag id="agents" />}
        title="Where your agents are allowed to run."
        body={
          <>
            <p>
              Personal agents are arriving with shell access, browser control and your inbox.
              On a laptop they run as you. On Woven they run as themselves: sandboxed, with
              their own identity, scoped credentials, and a receipt for everything they do.
            </p>
            <p>
              Install an agent the way you install an app. Give it the calendar and not the
              camera. Revoke it in one tap and the tokens die with it.
            </p>
          </>
        }
        points={[
          "OpenClaw-compatible agent runtime, sandboxed per agent",
          "Scoped, short-lived credentials issued by the box",
          "Every action passes the same permission engine as Tandem",
          "A discoverable endpoint on the LAN for robots and devices",
        ]}
        link={{ label: "Developers", href: "/developers" }}
      >
        <div className="w-full max-w-[520px] space-y-2">
          {[
            ["Tandem", "Household assistant", "Calendar · Files · Home · Photos", "active"],
            ["Grocer", "Reorders staples under $50", "Shopping list · Approved merchants", "active"],
            ["Sweep", "Robot vacuum planner", "Rooms · Occupancy · Robot API", "active"],
            ["Ledger", "Bills and budgets, read only", "Financial namespace", "paused"],
          ].map(([name, role, scopes, state]) => (
            <div
              key={name}
              className="flex items-center justify-between gap-4 rounded-[12px] bg-white/6 px-4 py-3.5 ring-1 ring-white/8"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`block h-[7px] w-[7px] rounded-full ${
                      state === "active" ? "bg-amber-2" : "bg-ash-2"
                    }`}
                  />
                  <span className="text-[15px] font-medium">{name}</span>
                  <span className="text-[13px] text-ash-2">{role}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ash-2">
                  {scopes}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ash-2">
                {state}
              </span>
            </div>
          ))}
        </div>
      </Feature>

      {/* Routing */}
      <section data-theme="light" className="bg-bone text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash">Inside and across the Gate</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              Most of the work never leaves. The rest asks.
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash">
              Tandem chooses by data class first, then latency, capability and your
              setting. Keeping things inside is policy, not a cosmetic toggle.
            </p>
          </Reveal>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="hairline border-b text-left text-ash">
                  <th className="pb-3 font-normal">Workload</th>
                  <th className="pb-3 font-normal">Runs</th>
                  <th className="pb-3 font-normal">Rule</th>
                </tr>
              </thead>
              <tbody>
                {routing.map(([w, r, rule]) => (
                  <tr key={w} className="hairline border-b">
                    <td className="py-3 font-medium">{w}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                          r.startsWith("Crosses") ? "bg-ask-bg text-ask" : "bg-local-bg text-local"
                        }`}
                      >
                        {r}
                      </span>
                    </td>
                    <td className="py-3 text-ash">{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[560px] text-[13px] text-ash">
            Planning target: more than sixty percent of ordinary supported requests complete
            without a crossing. Measured in the pilot, shown on your screen, never promised
            in marketing.
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
            Tandem ships on every Core.
          </h2>
          <p className="mt-2 text-[15px] text-ash-2">No subscription for the assistant inside. Ever.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link href="/order" className="btn btn-primary">
              Reserve
            </Link>
            <Link href="/core-plus" className="btn btn-secondary">
              Woven Core+
            </Link>
          </div>
        </Reveal>
      </section>

      <Footnotes notes={notes} />
    </>
  );
}
