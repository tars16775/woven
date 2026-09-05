import type { Metadata } from "next";
import Link from "next/link";
import { Block, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Support",
  description: "Set up Woven Core, common questions, and how to reach a person.",
};

const faq: [string, string][] = [
  [
    "Does the box need an internet connection?",
    "No. Setup, voice, home control, files, photos and cameras work inside, on your own network. An internet connection is needed for Gate crossings, remote access from outside the house, and software updates.",
  ],
  [
    "What happens if I stop paying for Gate crossings?",
    "Nothing changes on the box. Crossings become unavailable and Tandem says so when a job would have needed one. The assistant, storage and home control inside never depend on a subscription.",
  ],
  [
    "Can I use my existing Home Assistant setup?",
    "Yes. Woven Core runs Home Assistant inside and can import an existing configuration during setup. Zigbee networks migrate with their keys, so devices do not need re-pairing.",
  ],
  [
    "How does a compute module upgrade work?",
    "Power down, open the service panel, pull the module by its handle, seat the new one until it locks, power up. The chassis checks the module's identity and power envelope before household storage unlocks. No re-pairing, no rebuilt automations.",
  ],
  [
    "Is my data encrypted?",
    "Yes, at rest by default. Keys live in the secure element and are released only to an attested compute module. A drive removed from the chassis cannot be read without them.",
  ],
  [
    "What do you collect?",
    "Reliability and health telemetry that you can read on the box and switch off. Never message content, files, photos, voice or camera data. Diagnostics bundles for support require your explicit consent each time.",
  ],
  [
    "Can I cancel a reservation?",
    "Any time before the box ships, for a full refund of the deposit. Nothing else is charged until you confirm at shipment.",
  ],
];

export default function SupportPage() {
  return (
    <PageFrame
      eyebrow="Support"
      title="Set up in two minutes. Reach a person in one."
      intro="Most questions are answered on the box's own screen. For the rest, here is what you need."
      aside={
        <div className="rounded-[14px] bg-bone p-5 text-[14px]">
          <div className="font-medium">Talk to a person</div>
          <p className="mt-2 text-ash">
            Founding Homes have a named contact. Everyone else reaches the same team by email.
          </p>
          <a href={`mailto:${email.support}`} className="mt-3 block font-medium underline decoration-amber decoration-2 underline-offset-4">
            {email.support}
          </a>
          <div className="mt-5 font-medium">Security</div>
          <p className="mt-2 text-ash">Found a vulnerability? We want to know first.</p>
          <a href={`mailto:${email.security}`} className="mt-3 block font-medium underline decoration-amber decoration-2 underline-offset-4">
            {email.security}
          </a>
        </div>
      }
    >
      <Block id="setup" title="Setup">
        <ol className="max-w-[640px] space-y-4">
          {[
            ["Plug in", "Connect power and, if you have it, Ethernet. Wi-Fi works too. The screen wakes and shows a code."],
            ["Scan", "Scan the code with the Woven app, or tap through on the screen if your phone is elsewhere. Name the house and the first person."],
            ["Done", "The screen says Ready. Devices are discovered as you add them. Nothing has left the house."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="mt-0.5 font-mono text-[12px] text-amber">{i + 1}</span>
              <div>
                <div className="font-medium">{t}</div>
                <p className="text-ash">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="questions" title="Common questions">
        <div className="max-w-[640px] divide-y divide-ink/8">
          {faq.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium marker:hidden">
                {q}
                <span className="shrink-0 font-mono text-[14px] text-ash transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-ash">{a}</p>
            </details>
          ))}
        </div>
      </Block>

      <Block id="status" title="Status and updates">
        <p>
          The box tells you when an update is ready and installs it to a second slot, so a
          failed update rolls back on its own. Release notes and the security support window
          are published with every update.
        </p>
        <p>
          <Link href="/legal#warranty">Warranty and returns</Link> ·{" "}
          <Link href="/privacy">Privacy</Link> · <Link href="/developers">Developers</Link>
        </p>
      </Block>
    </PageFrame>
  );
}
