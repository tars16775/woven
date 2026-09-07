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
    "Can I use Woven today?",
    "Yes, the software. Woven Core runs on a Mac with Apple silicon and does everything on this site marked available now: a household with passkeys and per-person spaces, files and photos with search, the Gate with its receipts, encryption at rest, nightly snapshots with a restore drill, remote access, and one switch that stops it all. It costs nothing. The radios, cameras, router, television output and the assistant's model need the box, and the dashboard says so on the screen where each would be.",
  ],
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
    "That is the plan, and none of it is built. Home Assistant is meant to run inside Woven with your configuration imported during setup, and Zigbee networks to migrate with their keys so nothing is re-paired. No integration has been written and no migration has been attempted, so treat this as an intention rather than a feature.",
  ],
  [
    "How does a compute module upgrade work?",
    "As designed: power down, open the service panel, pull the module by its handle, seat the new one until it locks, power up, and the chassis checks the module's identity and power envelope before household storage unlocks. No chassis or module has been manufactured, so nothing has been swapped or timed.",
  ],
  [
    "Is my data encrypted?",
    "Yes, at rest by default: the database, every file and the box's private keys are encrypted under a household key. On the Woven box that key lives in the secure element and is released only to an attested compute module; on a Mac running Woven Core it lives in your login Keychain. A drive removed from the chassis, or a copied data folder, cannot be read without it.",
  ],
  [
    "What do you collect?",
    "Nothing. There is no service collecting anything, and a Core on your Mac reaches us in no way at all. The software can send one line a night saying its version and how long it has been up; that is off unless you turn it on, it goes out through the Gate like anything else, and it leaves a receipt you can read. Diagnostics bundles are written on the box and only leave if you send one.",
  ],
  [
    "Can I cancel a reservation?",
    "There is nothing to cancel. A reservation takes no money and, until an ordering service exists, is a note kept in your own browser. When deposits are taken they are refundable any time before shipment, and the balance is charged only when you confirm.",
  ],
];

export default function SupportPage() {
  return (
    <PageFrame
      eyebrow="Support"
      title="Set up in two minutes. Reach a person in one."
      intro="The box does not exist yet; the software does, and runs on a Mac. Below is how setting up works, what people ask most, and how to reach someone."
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
      <Block id="setup" title="Setting up on a Mac, today">
        <ol className="max-w-[640px] space-y-4">
          {[
            ["Run it", "One command builds and starts a Core from a checkout, or installs it as a login service. Your data goes in a folder you choose."],
            ["Make your house", "Name the house and yourself, add a passkey with Touch ID, and write down the recovery codes. About a minute."],
            ["Add the rest", "Other devices at home trust the household certificate once, then use the dashboard. Other Macs back up to it with a token you make in Settings."],
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
        <p className="mt-5 max-w-[640px] text-[14px] text-ash">
          The commands are on{" "}
          <Link href="/mac" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            the Mac page
          </Link>
          .
        </p>
      </Block>

      <Block id="setup-box" title="Setting up the box, when there is one">
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
        <p className="mt-5 max-w-[640px] text-[14px] text-ash">
          Written from the design. No box has been built, so nobody has done this yet.
        </p>
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
