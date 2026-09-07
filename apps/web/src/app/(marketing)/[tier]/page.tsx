import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Core3D } from "@/components/core-3d";
import { Compare } from "@/components/compare";
import { Feature } from "@/components/feature";
import { Module3D } from "@/components/module-3d";
import { Reveal } from "@/components/reveal";
import { InTheBox, ScreenReady } from "@/components/screen";
import { SpecStrip } from "@/components/spec-strip";
import { SpecTable } from "@/components/spec-table";
import { ProductNav } from "@/components/product-nav";
import { TVFrame } from "@/components/tv-frame";
import { AppHome, AppPrivacy } from "@/components/phone/screens";
import { formatPrice, tierOrder, tiers, type TierId } from "@/lib/site";
import { ClaimTag, Fn, Footnotes } from "@/components/claim";
import type { ClaimId } from "@/lib/claims";

export const dynamicParams = false;

export function generateStaticParams() {
  return tierOrder.map((tier) => ({ tier }));
}

export async function generateMetadata({ params }: PageProps<"/[tier]">): Promise<Metadata> {
  const { tier } = await params;
  const t = tiers[tier as TierId];
  if (!t) return {};
  return { title: t.name, description: t.tagline };
}

const adapterByTier: Record<TierId, string> = {
  core: "120 W",
  "core-plus": "180 W",
  "core-pro": "240 W",
};

const statusByTier: Record<TierId, string> = {
  core: "12 devices · inside",
  "core-plus": "24 devices · inside · Gate closed",
  "core-pro": "16 cameras · 3 agents · inside",
};

/** The notes at the foot of every product page, in the order their markers appear. */
const notes = ["price", "delivery", "tandem", "radios", "receipts", "tv", "router", "moduleSwap", "secureElement", "wifi", "power", "warranty", "support"] as const satisfies readonly ClaimId[];

export default async function TierPage({ params }: PageProps<"/[tier]">) {
  const { tier } = await params;
  const t = tiers[tier as TierId];
  if (!t) notFound();
  const id = t.id;

  return (
    <div data-product-nav>
      {/* Hero with stat strip */}
      <section
        data-theme="light"
        className="relative flex min-h-svh flex-col bg-bone text-ink"
      >
        <Reveal className="px-6 pt-24 text-center md:pt-28">
          <p className="text-[13px] font-medium text-ash">{t.eyebrow}</p>
          <h1 className="mt-2 font-display text-[38px] font-medium leading-[1.02] tracking-[-0.025em] md:text-[58px] lg:text-[68px] md:leading-[1.04]">
            {t.name}
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-relaxed text-ash md:text-[15px]">
            {t.tagline}
          </p>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] text-ash">
            From {formatPrice(t.priceFrom)}
            <Fn notes={notes} id="price" />, shipping in 2027
            <Fn notes={notes} id="delivery" />. The box is not built yet, and a reservation takes no
            money.{" "}
            <Link href="/mac" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              The software runs on a Mac today
            </Link>
            .
          </p>
        </Reveal>
        <div className="flex flex-1 items-center justify-center px-6 py-6">
          <Core3D label={t.screenLabel} status={statusByTier[id]} ignite className="h-[46svh] max-h-[560px] w-full max-w-[1000px]" />
        </div>
        <SpecStrip tier={t} cta={{ label: "Reserve", href: `/order?tier=${id}` }} />
      </section>

      {/* Store */}
      <Feature
        id="store"
        theme="white"
        eyebrow="Store"
        title="Every device backs up to the box."
        body={
          <>
            <p>
              Phones, laptops and cameras sync to {t.storageTb} TB of encrypted storage that
              never leaves the house. Photos are indexed on the box by faces, places and
              dates. Media plays to any screen on the network.
            </p>
            <p>
              Two tool-less drive sleds take you to sixteen terabytes without opening a
              settings menu.
            </p>
          </>
        }
        points={[
          `${t.storageTb} TB included, encrypted at rest`,
          "Backup and sync for every device in the household",
          "Photo library indexed inside, searchable by what is in them",
          "Camera clips saved on the box, never uploaded",
        ]}
        link={{ label: "See the app", href: "/home" }}
      >
        <AppHome width={280} />
      </Feature>

      {/* Think */}
      <Feature
        id="think"
        theme="dark"
        flip
        eyebrow="Think"
        tag={<ClaimTag id="tandem" />}
        title={`A ${t.modelClass} model, resident and private.`}
        body={
          <>
            <p>
              {t.memoryGb} GB of unified memory keeps a {t.modelClass}-class model loaded
              beside speech, embedding and vision models, so Tandem answers in under a second
              without anything crossing the Gate.
            </p>
            <p>
              When a job needs more, Tandem asks first, sends the minimum, and writes down
              exactly what left.
            </p>
          </>
        }
        points={[
          `${t.memoryGb} GB unified memory`,
          `${t.modelClass}-class model inside, with room for retrieval`,
          "Speech, intent and photo models on the NPU",
          "Crossings by permission, recorded on the screen",
        ]}
        link={{ label: "Meet Tandem", href: "/tandem" }}
      >
        <ScreenReady className="max-w-[640px]" />
      </Feature>

      {/* Connect */}
      <Feature
        id="connect"
        theme="white"
        eyebrow="Connect"
        tag={<ClaimTag id="radios" />}
        title="Matter, Thread and Zigbee, built in."
        body={
          <>
            <p>
              The radios are in the chassis, not on a dongle. Lights, locks, sensors and
              thermostats pair once and keep working when the internet does not.
            </p>
            <p>
              Up to {t.cameras} camera streams are detected and archived inside. Native
              Home Assistant runs inside, so nothing you have already set up is wasted.
            </p>
          </>
        }
        points={[
          "Matter over Thread, Wi-Fi and Ethernet",
          "Zigbee coordinator built in, Z-Wave by USB",
          `${t.cameras} camera streams, all inside`,
          "Routines run on the box, offline",
        ]}
        link={{ label: "Supported devices", href: "/home#devices" }}
      >
        <div className="grid w-full max-w-[520px] grid-cols-2 gap-3">
          {[
            ["Lights", "Matter · Thread"],
            ["Locks", "Matter · Zigbee"],
            ["Thermostat", "Matter"],
            ["Sensors", "Thread · Zigbee"],
            ["Cameras", "RTSP · ONVIF"],
            ["Robot", "LAN API"],
          ].map(([name, proto]) => (
            <div
              key={name}
              className="rounded-[12px] bg-bone px-5 py-5 ring-1 ring-ink/5"
            >
              <div className="flex items-center gap-2">
                <span className="block h-[7px] w-[7px] rounded-full bg-amber" />
                <span className="text-[15px] font-medium">{name}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                {proto}
              </div>
            </div>
          ))}
        </div>
      </Feature>

      {/* Govern */}
      <Feature
        id="govern"
        theme="dark"
        flip
        eyebrow="Govern"
        tag={<ClaimTag id="receipts" />}
        title="Where your data went today."
        body={
          <>
            <p>
              The front screen and the app both show one thing above all else: what stayed
              home and what left. Each crossing is listed with what was sent and why.
            </p>
            <p>
              Every agent, assistant and robot in the house acts through Woven with its own
              identity, scoped permissions and a receipt.
            </p>
          </>
        }
        points={[
          "Per-category rules: Inside, ask me first, or off",
          "One tap to close the Gate",
          "Agents run sandboxed with scoped credentials",
          "Receipts for every consequential action",
        ]}
        link={{ label: "Privacy", href: "/privacy" }}
      >
        <AppPrivacy width={280} />
      </Feature>

      {/* TV */}
      <Feature
        id="tv"
        theme="light"
        eyebrow="On your TV · included"
        tag={<ClaimTag id="tv" />}
        title="Plug it into the television."
        body={
          <>
            <p>
              One HDMI cable and the biggest screen in the house shows your photos, your movies,
              your cameras and Tandem. Your phone is the remote, or your voice is.
            </p>
            <p>No subscription, no account, no ads, and nothing watching back.</p>
          </>
        }
        points={["HDMI 2.1 · 4K at 120 · HDR", "Photos, movies, cameras, Ask", "Served from the box, never streamed out", "Included with every Core"]}
        link={{ label: "Woven on TV", href: "/home#tv" }}
      >
        <div className="w-full max-w-[640px]">
          <TVFrame label="Woven on the living room television: this week's photos, four live cameras, continue watching and Ask Tandem." />
        </div>
      </Feature>

      {/* Router */}
      <Feature
        id="router"
        theme="dark"
        flip
        eyebrow="Outside · the router"
        tag={<ClaimTag id="router" />}
        title="It is your Wi-Fi too."
        body={
          <>
            <p>
              {t.wifi} for the whole house and {t.ethernet.split(" · ")[0]} to the internet, on a
              separate network processor that cannot see inside. A guest network for visitors.
              Rules and schedules for every device.
            </p>
            <p>One box replaces the router, the hub and the NAS, and keeps them apart.</p>
          </>
        }
        points={[t.wifi, t.ethernet, "Guest network that sees nothing inside", "The Gate: approved crossings only, all recorded"]}
        link={{ label: "How the Gate works", href: "/privacy#gate" }}
      >
        <div className="grid w-full max-w-[520px] gap-3">
          {[
            ["Inside", "Files · Photos · Cameras · Home · Tandem · TV", "No route to the internet", "dark"],
            ["The Gate", "Approved tasks · Signed updates · Your key", "Every crossing recorded", "amber"],
            ["Outside", "Wi-Fi 7 · Internet · Guest network · Rules", "Its own processor", "bone"],
          ].map(([k, v, d, tone]) => (
            <div
              key={k}
              className={`rounded-[12px] px-5 py-4 ${
                tone === "dark" ? "bg-white/6 ring-1 ring-white/10" : tone === "amber" ? "bg-amber/10 ring-1 ring-amber/40" : "bg-bone text-ink"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-[18px] font-medium tracking-[-0.01em]">{k}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">{d}</div>
              </div>
              <div className="mt-1 text-[13px] opacity-75">{v}</div>
            </div>
          ))}
        </div>
      </Feature>

      {/* Upgrade */}
      <Feature
        id="module"
        theme="light"
        eyebrow="Upgrade"
        tag={<ClaimTag id="moduleSwap" />}
        title="Buy the chassis once. Upgrade the brain."
        body={
          <>
            <p>
              The chassis carries storage, radios, ports, cooling and a secure hardware
              identity for eight to ten years. The compute module carries the processor,
              graphics, NPU and memory, and is designed to be replaced every three to four
              years.
            </p>
            <p>
              Power down, open the panel, swap the module, power up. Household data, device
              pairings, permissions and automations are exactly where you left them.
            </p>
          </>
        }
        points={[
          "Tool-less module bay with a positive lock",
          "Module attests to the chassis before storage unlocks",
          "No re-pairing, no rebuilt automations",
          "Upgrade modules from $600",
        ]}
        link={{ label: "What's in the box", href: `/${id}#box` }}
      >
        <Module3D className="h-[300px] w-full max-w-[640px] md:h-[400px]" />
      </Feature>

      {/* In the box */}
      <Feature
        id="box"
        theme="white"
        flip
        eyebrow="In the box"
        tag={<ClaimTag id="delivery" />}
        title="Everything you need. Nothing to subscribe to."
        body={
          <>
            <p>
              The box arrives with its module seated, its keys made, and the software already
              on it. Plug it in, scan the code on the screen, and it is running before the
              kettle boils.
            </p>
            <p>
              Every app, the assistant and lifetime OS updates are included. A year of Gate
              crossings credit is too, and when it runs out nothing on the box changes.
            </p>
          </>
        }
        link={{ label: "Set up in two minutes", href: "/support#setup" }}
      >
        <InTheBox name={t.name.replace("Woven ", "")} adapter={adapterByTier[id]} />
      </Feature>

      <SpecTable tier={id} />
      <Compare current={id} />

      {/* Closing */}
      <section
        id="reserve"
        data-theme="light"
        className="flex min-h-[70svh] flex-col items-center justify-center bg-bone px-6 py-24 text-center text-ink"
      >
        <Reveal>
          <span className="orb mx-auto block" style={{ ["--orb" as string]: "14px" }} />
          <h2 className="mt-12 font-display text-[36px] font-medium tracking-[-0.02em] md:text-[44px]">
            {t.name}
          </h2>
          <p className="mt-2 text-[15px] text-ash">From {formatPrice(t.priceFrom)}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link href={`/order?tier=${id}`} className="btn btn-primary">
              Reserve
            </Link>
            <Link href="/founding-homes" className="btn btn-secondary">
              Founding Homes
            </Link>
          </div>
        </Reveal>
      </section>

      <ProductNav
        name={t.name}
        price={formatPrice(t.priceFrom)}
        items={[
          { label: "Overview", href: "#store" },
          { label: "Think", href: "#think" },
          { label: "Connect", href: "#connect" },
          { label: "Router", href: "#router" },
          { label: "Specs", href: "#specs" },
          { label: "Compare", href: "#compare" },
        ]}
        cta={{ label: "Reserve", href: `/order?tier=${id}` }}
      />
      <Footnotes notes={notes} />
    </div>
  );
}
