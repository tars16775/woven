import type { Metadata } from "next";
import Link from "next/link";
import { Feature } from "@/components/feature";
import { Reveal } from "@/components/reveal";
import { ScreenActivity } from "@/components/screen";
import { Section } from "@/components/section";
import { TVFrame } from "@/components/tv-frame";
import { AppRooms } from "@/components/phone/screens";
import { ClaimTag, Fn, Footnotes } from "@/components/claim";
import type { ClaimId } from "@/lib/claims";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Matter, Thread and Zigbee radios built in. Lights, locks, sensors, thermostats and cameras that keep working when the internet is down.",
};

const devices = [
  ["Lights", "Matter over Thread and Wi-Fi · Zigbee", "On, off, brightness, colour temperature", "Automatic"],
  ["Plugs and switches", "Matter · Zigbee", "State, command, energy where exposed", "Automatic"],
  ["Thermostats", "Matter · vendor API", "Setpoint within your bounds", "Automatic within bounds"],
  ["Locks", "Matter · Zigbee · vendor API", "Lock, unlock, state verification", "Unlock needs approval"],
  ["Sensors", "Thread · Zigbee · Z-Wave", "Motion, contact, temperature, humidity", "Automatic"],
  ["Cameras", "RTSP · ONVIF · supported APIs", "Detection, events, clips on the box", "Inside only"],
  ["Robot vacuums", "Vendor API · LAN", "Start, stop, room targeting, completion", "Automatic"],
  ["Vehicles", "Vendor API", "Prepare destination, charge state, status", "Read only"],
];

const receipt = [
  ["21:40:02", "Ask", "“Tandem, I'm leaving for dinner.”", "inside"],
  ["21:40:02", "Check", "Occupancy: nobody else home. Routine: Leaving.", "inside"],
  ["21:40:03", "Prepare", "6 lights off · thermostat 18 °C · front door lock", "inside"],
  ["21:40:03", "Approve", "Lock is class D. Alex is present. Auto-approved.", "policy"],
  ["21:40:04", "Execute", "6 lights · thermostat · lock", "inside"],
  ["21:40:05", "Verify", "Lights read back off. Thermostat 18 °C. Lock bolt: locked.", "device"],
  ["21:40:05", "Receipt", "Written. Visible on the screen and in Activity.", "inside"],
];

/** The notes at the foot of this page, in the order their markers appear. */
const notes = ["radios", "receipts", "cameras", "tv", "router"] as const satisfies readonly ClaimId[];

export default function HomePage() {
  return (
    <>
      <Section
        theme="white"
        titleAs="h1"
        eyebrow="Home"
        tag={<ClaimTag id="radios" />}
        title="Your smart home, with a brain in the house."
        subtitle={
          <>
            The radios are in the chassis. Devices pair once, routines run inside, and everything keeps answering when the internet does not, because it never needed it.
            <Fn notes={notes} id="radios" />
          </>
        }
        primary={{ label: "Reserve a Core", href: "/order" }}
        secondary={{ label: "Supported devices", href: "#devices" }}
        align="end"
      >
        <AppRooms width={300} />
      </Section>

      <Feature
        theme="light"
        eyebrow="Radios"
        tag={<ClaimTag id="radios" />}
        title="Matter, Thread and Zigbee. No dongles."
        body={
          <>
            <p>
              Woven Core is a Thread border router, a Matter controller and a Zigbee
              coordinator in one enclosure, with antennas placed for a home and not for a
              server rack. Z-Wave is available by USB where the region calls for it.
            </p>
            <p>
              Native Home Assistant runs inside. Anything you have already set up carries
              over.
            </p>
          </>
        }
        points={[
          "Matter over Thread, Wi-Fi and Ethernet",
          "Thread border router with fabric migration",
          "Zigbee coordinator with key backup",
          "Home Assistant inside, with one-tap add-ons",
        ]}
      >
        <div className="grid w-full max-w-[520px] grid-cols-2 gap-3">
          {[
            ["Matter", "Controller"],
            ["Thread", "Border router"],
            ["Zigbee", "Coordinator"],
            ["Z-Wave", "USB, by region"],
            ["Wi-Fi 7", "Devices + uplink"],
            ["Bluetooth 5.4", "Commissioning"],
          ].map(([name, role]) => (
            <div key={name} className="rounded-[12px] bg-white px-5 py-5 ring-1 ring-ink/5">
              <div className="text-[15px] font-medium">{name}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                {role}
              </div>
            </div>
          ))}
        </div>
      </Feature>

      {/* Receipt of a routine: a real sequence in time */}
      <section data-theme="dark" className="bg-graphite text-bone">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash-2">A routine, with its receipt</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              &ldquo;I&rsquo;m leaving for dinner.&rdquo;
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash-2">
              Three seconds, seven steps, one receipt. The lock is a class D action, so
              Tandem checks presence before it moves. Nothing here needed the internet.
            </p>
          </Reveal>
          <div className="mt-10 overflow-hidden rounded-[14px] bg-graphite-2 ring-1 ring-white/8">
            {receipt.map(([t, step, detail, where], i) => (
              <div
                key={i}
                className="grid grid-cols-[72px_84px_1fr_auto] items-baseline gap-3 border-b border-white/6 px-5 py-3 text-[14px] last:border-b-0 md:grid-cols-[88px_96px_1fr_auto]"
              >
                <span className="font-mono text-[12px] text-ash-2">{t}</span>
                <span className="font-medium">{step}</span>
                <span className="text-bone/85">{detail}</span>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">
                  <span
                    className={`block h-[6px] w-[6px] rounded-full ${
                      where === "device" ? "bg-local" : "bg-amber-2"
                    }`}
                  />
                  {where}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Feature
        theme="white"
        eyebrow="Offline"
        tag={<ClaimTag id="radios" />}
        title="Unplug the internet. The house still listens."
        body={
          <>
            <p>
              Voice, intent, home control and private memory run on the box. When the
              connection drops, supported devices keep responding and routines keep firing.
              Features that need the Outside are marked unavailable instead of pretending.
            </p>
            <p>
              When the connection returns, queued sync resumes without repeating an action.
            </p>
          </>
        }
        points={[
          "Voice inside: wake word, speech and intent on the NPU",
          "Sub-second light and lock commands on the LAN",
          "Routines and occupancy rules run on the box",
          "Honest state: live, stale or offline, always labelled",
        ]}
        link={{ label: "Meet Tandem", href: "/tandem" }}
      >
        <div className="w-full max-w-[520px] rounded-[18px] bg-graphite p-6 text-bone ring-1 ring-white/10">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ash-2">
            <span>Network</span>
            <span>WAN down · LAN up</span>
          </div>
          <ul className="mt-5 space-y-2 text-[14px]">
            {[
              ["Lights, locks, thermostat", "Working", true],
              ["Voice and Tandem", "Working, model inside", true],
              ["Files, photos, cameras", "Working", true],
              ["Routines and occupancy", "Working", true],
              ["Deep research", "Waiting for connection", false],
              ["Remote access from outside", "Waiting for connection", false],
            ].map(([k, v, ok]) => (
              <li key={k as string} className="flex items-center justify-between gap-4 border-b border-white/6 pb-2 last:border-b-0">
                <span>{k as string}</span>
                <span className="flex items-center gap-2 text-[13px] text-ash-2">
                  <span className={`block h-[6px] w-[6px] rounded-full ${ok ? "bg-local" : "bg-ash-2"}`} />
                  {v as string}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Feature>

      <Feature
        theme="light"
        flip
        eyebrow="Cameras"
        tag={<ClaimTag id="cameras" />}
        title="Detection, alerts and archives that stay home."
        body={
          <>
            <p>
              People, packages, cars and pets are detected on the NPU. Clips are saved to the
              box under a retention you set. Nothing is uploaded to be analysed.
            </p>
            <p>There is no facial recognition in the first release, by design.</p>
          </>
        }
        points={[
          "Detection inside, with per-camera zones",
          "Retention quotas you control",
          "Works with RTSP and ONVIF cameras you already own",
          "Hardware privacy indicator on the front of the box",
        ]}
      >
        <ScreenActivity className="max-w-[560px]" />
      </Feature>

      <Feature
        id="tv"
        theme="light"
        eyebrow="On your TV · included"
        tag={<ClaimTag id="tv" />}
        title="The biggest screen in the house, finally yours."
        body={
          <>
            <p>
              One HDMI cable. Your photos, your movies and your cameras on the television, with
              Tandem a word away. Your phone is the remote, or your voice is.
            </p>
            <p>Nothing you watch, browse or ask is reported to anyone, because nothing on the screen ever leaves the box.</p>
          </>
        }
        points={["HDMI 2.1 · 4K at 120 · HDR", "Photos, movies, cameras, Ask", "No subscription, no account, no ads", "Included with every Core"]}
      >
        <div className="w-full max-w-[640px]">
          <TVFrame label="Woven on the living room television: this week's photos, four live cameras, continue watching and Ask Tandem." />
        </div>
      </Feature>

      <section id="devices" data-theme="white" className="bg-white text-ink">
        <div className="mx-auto max-w-[1100px] px-6 py-24 lg:px-10">
          <Reveal>
            <p className="text-[13px] font-medium text-ash">Supported devices</p>
            <h2 className="mt-2 max-w-[640px] font-display text-[32px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              A tested list, not a universal promise.
            </h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ash">
              Every category below is exercised on a bench and in pilot homes before it is
              listed. The pilot gate is twenty tested devices across five categories.
            </p>
          </Reveal>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="hairline border-b text-left text-ash">
                  <th className="pb-3 font-normal">Category</th>
                  <th className="pb-3 font-normal">Protocols</th>
                  <th className="pb-3 font-normal">What works</th>
                  <th className="pb-3 font-normal">Default</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(([c, p, w, d]) => (
                  <tr key={c} className="hairline border-b align-top">
                    <td className="py-3 font-medium">{c}</td>
                    <td className="py-3 text-ash">{p}</td>
                    <td className="py-3">{w}</td>
                    <td className="py-3 text-ash">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        data-theme="light"
        className="flex min-h-[60svh] flex-col items-center justify-center bg-bone px-6 py-24 text-center text-ink"
      >
        <Reveal>
          <span className="orb mx-auto block" style={{ ["--orb" as string]: "14px" }} />
          <h2 className="mt-12 font-display text-[36px] font-medium tracking-[-0.02em] md:text-[44px]">
            The hub you already wanted, with a brain.
          </h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link href="/order" className="btn btn-primary">
              Reserve
            </Link>
            <Link href="/core" className="btn btn-secondary">
              Woven Core from $899
            </Link>
          </div>
        </Reveal>
      </section>

      <Footnotes notes={notes} />
    </>
  );
}
