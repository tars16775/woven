import Link from "next/link";
import { Core3D } from "@/components/core-3d";
import { Module3D } from "@/components/module-3d";
import { ModuleSwap } from "@/components/module-swap";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { TwoSides } from "@/components/two-sides";
import { TVFrame } from "@/components/tv-frame";
import { AppAsk, AppHome, AppPhotos, AppPrivacy, AppRooms } from "@/components/phone/screens";
import { tiers, formatPrice } from "@/lib/site";

const whyNot = [
  {
    name: "A NAS",
    price: "From about $500, plus drives",
    gives: "Your files and backups at home, on drives you own, with a catalogue of apps.",
    lacks: "Its AI is weak, its camera apps phone home to the vendor's cloud, and there is no Gate: every app on it can reach the internet.",
    woven: "The same files, with a model inside that can read them, cameras that stay inside, and one Gate for everything.",
  },
  {
    name: "Home Assistant on a Green",
    price: "$199",
    gives: "Local automations for thousands of devices, and a community that has seen everything.",
    lacks: "No assistant-class compute, no storage for photos or files, no router, and it is yours to run and maintain.",
    woven: "Home Assistant runs inside Woven as it is. The box adds the compute, the storage, the screen and the router around it.",
  },
  {
    name: "A Mac mini with OpenClaw",
    price: "From $599, plus your weekends",
    gives: "Real agents on real compute, in your house, running whatever you install.",
    lacks: "The agents run as you, with your logins and full internet access. There are no household permissions and no record of what left.",
    woven: "Agents run as themselves, sandboxed, with scoped credentials and a receipt for every action. They cross the Gate only when you say so.",
  },
  {
    name: "A cloud assistant plus a router",
    price: "Free to start, then a subscription",
    gives: "A capable assistant that is always current, and Wi-Fi from a box that knows nothing about you.",
    lacks: "It needs the internet to understand a sentence, so every request leaves the house, and it stops when the connection or the subscription does.",
    woven: "Intent, speech and home control happen inside and keep working offline. A crossing is a choice, approved one at a time.",
  },
];

export default function HomePage() {
  const plus = tiers["core-plus"];
  const pro = tiers["core-pro"];
  const core = tiers.core;

  return (
    <>
      {/* Hero */}
      <Section
        id="hero"
        theme="light"
        titleAs="h1"
        eyebrow="One box for the whole house"
        title={plus.name}
        subtitle={
          <>
            Your files, photos, cameras and smart home. A private assistant. Your TV and your
            Wi-Fi. Everything of yours stays inside the house.
            <br />
            From {formatPrice(plus.priceFrom)}
          </>
        }
        primary={{ label: "Reserve", href: "/order?tier=core-plus" }}
        secondary={{ label: "Learn more", href: "/core-plus" }}
        cue="#sides"
      >
        <Core3D label={plus.screenLabel} status="24 devices · inside · Gate closed" ignite className="h-[52svh] max-h-[620px] w-full max-w-[1100px]" />
      </Section>

      {/* The architecture */}
      <Section
        id="sides"
        theme="dark"
        eyebrow="How it is built"
        title="Two computers. One is on the internet."
        subtitle="Two computers in one box, and only one of them is on the internet. The Inside holds everything of yours and has no route out. The Outside is your router. Between them is the Gate, and only what you approve crosses it."
        primary={{ label: "Privacy", href: "/privacy" }}
        secondary={{ label: "The spec", href: "/core-plus#specs" }}
      >
        <TwoSides />
      </Section>

      {/* Tandem */}
      <Section
        id="tandem"
        theme="dark"
        eyebrow="Tandem"
        title="Ask. It already knows the house."
        subtitle="A household assistant that runs inside. It knows the calendar, the files, the photos and the home, answers in under a second, and asks before anything crosses the Gate."
        primary={{ label: "Meet Tandem", href: "/tandem" }}
        secondary={{ label: "See what leaves", href: "/privacy" }}
        align="end"
      >
        <div className="flex items-end gap-6 md:gap-10">
          <div className="hidden md:block">
            <AppHome width={250} />
          </div>
          <AppAsk width={290} />
          <div className="hidden lg:block">
            <AppPrivacy width={250} />
          </div>
        </div>
      </Section>

      {/* TV */}
      <Section
        id="tv"
        theme="light"
        eyebrow="On your TV · included"
        title="Plug it into the television."
        subtitle="One HDMI cable and the biggest screen in the house shows your photos, your movies, your cameras and Tandem. No subscription, no account, no ads, nothing watching back."
        primary={{ label: "Woven on TV", href: "/home#tv" }}
        secondary={{ label: "Woven Core+", href: "/core-plus" }}
      >
        <div className="w-full max-w-[1000px]">
          <TVFrame label="Woven on the living room television: this week's photos, four live cameras, continue watching and Ask Tandem." />
        </div>
      </Section>

      {/* Smart home */}
      <Section
        id="home"
        theme="white"
        eyebrow="Home"
        title="Your smart home, with a brain in the house."
        subtitle="Matter, Thread and Zigbee radios are built in. Lights, locks and thermostats answer in under a second, and keep answering when the internet is down, because they never needed it."
        primary={{ label: "Home", href: "/home" }}
        secondary={{ label: "Supported devices", href: "/home#devices" }}
        align="end"
      >
        <div className="flex items-end gap-6 md:gap-10">
          <AppRooms width={290} />
          <div className="hidden md:block">
            <AppPhotos width={250} />
          </div>
        </div>
      </Section>

      {/* Router */}
      <Section
        id="router"
        theme="white"
        eyebrow="Outside · the router"
        title="It is your Wi-Fi too."
        subtitle="Wi-Fi 7 for the whole house and a 10 GbE port to the internet, on a separate processor that cannot see inside. A guest network for visitors. Rules and schedules for every device. One box replaces the router, the hub and the NAS."
        primary={{ label: "How the Gate works", href: "/privacy#gate" }}
        secondary={{ label: "Why not something else?", href: "#why-not" }}
      >
        <div className="grid w-full max-w-[900px] gap-3 sm:grid-cols-3">
          {[
            ["Wi-Fi 7", "Tri-band, the whole house", "Outside"],
            ["10 GbE", "To the internet", "Outside"],
            ["Guest network", "Sees nothing inside", "Outside"],
            ["Per-device rules", "Bedtime for the console", "Outside"],
            ["Inside network", "Files, cameras, TV, agents", "Inside"],
            ["The Gate", "Approved crossings only", "Between"],
          ].map(([k, v, side]) => (
            <div key={k} className={`rounded-[14px] px-5 py-5 ring-1 ${side === "Inside" ? "bg-graphite text-bone ring-white/10" : side === "Between" ? "bg-amber/10 ring-amber/40" : "bg-bone ring-ink/5"}`}>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-70">{side}</div>
              <div className="mt-1 font-display text-[20px] font-medium tracking-[-0.01em]">{k}</div>
              <div className="mt-0.5 text-[13px] opacity-75">{v}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Why not something else */}
      <Section
        id="why-not"
        theme="white"
        eyebrow="Why not just…"
        title="A NAS, a Green, a Mac mini, a cloud assistant."
        subtitle="Each does one part of the job well. None has a Gate, and none was built to run the household's assistant as a household, with permissions per person and a record of what left."
        primary={{ label: "Woven Core+", href: "/core-plus" }}
        secondary={{ label: "Compare the three boxes", href: "/core-plus#compare" }}
      >
        <div className="grid w-full max-w-[1100px] gap-3 md:grid-cols-2 lg:grid-cols-4">
          {whyNot.map((c) => (
            <div key={c.name} className="flex flex-col rounded-[14px] bg-bone p-5 ring-1 ring-ink/5">
              <div className="font-display text-[20px] font-medium tracking-[-0.01em]">{c.name}</div>
              <div className="mt-0.5 text-[12px] text-ash">{c.price}</div>
              <dl className="mt-4 flex flex-1 flex-col gap-3 text-[13.5px] leading-snug">
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ash">What it gives you</dt>
                  <dd className="mt-1">{c.gives}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ash">What it does not</dt>
                  <dd className="mt-1 text-ash">{c.lacks}</dd>
                </div>
                <div className="mt-auto rounded-[10px] bg-graphite px-3.5 py-3 text-bone">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-2">On Woven</dt>
                  <dd className="mt-1 text-bone/90">{c.woven}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* Upgradeable compute: the module, then the exploded view */}
      <section id="module" data-theme="light" className="bg-bone text-ink">
        <Reveal className="px-6 pt-24 text-center md:pt-28">
          <p className="text-[13px] font-medium text-ash">Upgradeable compute</p>
          <h2 className="mt-2 font-display text-[32px] font-medium leading-[1.02] tracking-[-0.02em] md:text-[44px] md:leading-[1.05]">
            Buy the chassis once. Upgrade the brain.
          </h2>
          <p className="mx-auto mt-2 max-w-[600px] text-[14px] leading-relaxed text-ash md:text-[15px]">
            The chassis keeps your storage, radios, ports and keys for eight to ten years. The
            compute module carries the processor, the graphics, the neural engine and the
            memory, and swaps in sixty seconds. Keep scrolling.
          </p>
        </Reveal>
        <div className="mx-auto mt-6 h-[48svh] max-h-[520px] w-full max-w-[900px] px-6">
          <Module3D className="h-full w-full" />
        </div>
        <p className="mx-auto max-w-[560px] px-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
          Compute Module A1 · vapour chamber · 26 fins · 44 gold contacts
        </p>
        <ModuleSwap />
        <div className="flex flex-col items-center justify-center gap-3 px-6 pb-16 sm:flex-row sm:gap-4">
          <Link href="/core-plus#module" className="btn btn-primary">
            How it works
          </Link>
          <Link href="/core-plus#box" className="btn btn-secondary">
            What&apos;s in the box
          </Link>
        </div>
      </section>

      {/* Privacy */}
      <Section
        id="privacy"
        theme="dark"
        eyebrow="Where your data went today"
        title="Privacy you can glance at."
        subtitle="The front of the box and the app both keep one honest list: what stayed inside and what crossed the Gate, with what was sent and who approved it."
        primary={{ label: "Privacy", href: "/privacy" }}
        secondary={{ label: "Founding Homes", href: "/founding-homes" }}
        align="end"
      >
        <div className="flex items-end gap-6 md:gap-10">
          <AppPrivacy width={290} />
          <div className="hidden md:block">
            <AppAsk width={250} />
          </div>
        </div>
      </Section>

      {/* Core Pro */}
      <Section
        id="core-pro"
        theme="light"
        eyebrow={pro.eyebrow}
        title={pro.name}
        subtitle={`From ${formatPrice(pro.priceFrom)}`}
        primary={{ label: "Reserve", href: "/order?tier=core-pro" }}
        secondary={{ label: "Learn more", href: "/core-pro" }}
      >
        <Core3D label={pro.screenLabel} status="16 cameras · 3 agents · inside" yaw={0.42} className="h-[52svh] max-h-[620px] w-full max-w-[1100px]" />
      </Section>

      {/* Core */}
      <Section
        id="core"
        theme="light"
        eyebrow={core.eyebrow}
        title={core.name}
        subtitle={`From ${formatPrice(core.priceFrom)}`}
        primary={{ label: "Reserve", href: "/order?tier=core" }}
        secondary={{ label: "Learn more", href: "/core" }}
      >
        <Core3D label={core.screenLabel} status="12 devices · inside" className="h-[48svh] max-h-[560px] w-full max-w-[1000px]" />
      </Section>

      {/* Agents */}
      <Section
        id="agents"
        theme="dark"
        eyebrow="Agents"
        title="Where your agents are allowed to run."
        subtitle="Personal agents are arriving with shell access and your inbox. On Woven they run inside, sandboxed, with their own identity, scoped permissions and a receipt for everything they do. They cannot reach the internet unless you open the Gate."
        primary={{ label: "Learn more", href: "/tandem#agents" }}
        secondary={{ label: "Developers", href: "/developers" }}
      >
        <div className="w-full max-w-[560px] space-y-2">
          {[
            ["Tandem", "Household assistant", "Calendar · Files · Home · Photos", "active"],
            ["Grocer", "Reorders staples under $50", "Shopping list · Approved merchants · Gate", "active"],
            ["Sweep", "Robot vacuum planner", "Rooms · Occupancy · Robot API", "active"],
            ["Ledger", "Bills and budgets, read only", "Financial namespace", "paused"],
          ].map(([name, role, scopes, state]) => (
            <div key={name} className="flex items-center justify-between gap-4 rounded-[12px] bg-white/6 px-4 py-3.5 ring-1 ring-white/8">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`block h-[7px] w-[7px] rounded-full ${state === "active" ? "bg-amber-2" : "bg-ash-2"}`} />
                  <span className="text-[15px] font-medium">{name}</span>
                  <span className="text-[13px] text-ash-2">{role}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ash-2">{scopes}</div>
              </div>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ash-2">{state}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Founding Homes */}
      <Section
        id="founding"
        theme="light"
        eyebrow="Founding Homes · Q4 2026"
        title="Fifty households go first."
        subtitle="Woven OS on off-the-shelf boxes, in real homes, before any chassis is tooled. Founding Homes get the hardware at cost and a direct line to the people building it."
        primary={{ label: "Apply", href: "/founding-homes" }}
        secondary={{ label: "Read the plan", href: "/founding-homes#plan" }}
      >
        <div className="flex flex-col items-center">
          <span className="orb" style={{ ["--orb" as string]: "16px" }} />
          <p className="mt-16 font-mono text-[12px] uppercase tracking-[0.2em] text-ash">50 homes · 6 weeks · at cost</p>
        </div>
      </Section>
    </>
  );
}
