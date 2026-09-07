import type { Metadata } from "next";
import Link from "next/link";
import { Block, Code, PageFrame } from "@/components/page-frame";
import { AvailabilityTag, Fn, Footnotes } from "@/components/claim";
import { claims, type ClaimId } from "@/lib/claims";

export const metadata: Metadata = {
  title: "Woven on your Mac",
  description:
    "Run a Woven Core on a Mac you already own: the same software the box will run, with the same Gate, the same receipts and the same permissions. Free, and open to inspection.",
};

const notes = ["gate", "receipts", "encryption", "passkeys", "photoSearch", "remote", "killSwitch", "backups", "search", "radios", "cameras", "router", "tandem", "voice", "agents", "delivery"] as const satisfies readonly ClaimId[];

/** What a household can do tonight, and what it plainly cannot. Both from the registry. */
const runs: ClaimId[] = ["passkeys", "backups", "search", "photoSearch", "gate", "receipts", "encryption", "remote", "killSwitch"];
const waits: ClaimId[] = ["radios", "cameras", "router", "tandem", "voice", "agents"];

export default function MacPage() {
  return (
    <>
      <PageFrame
        eyebrow="Woven on your Mac"
        title="The box is coming. The software is here."
        intro="A Woven Core runs on a Mac with Apple silicon: the same core the box will run, with the same Gate, the same receipts and the same permissions. It is free, it takes nothing from you, and every claim on this site marked available now can be checked on it."
        aside={
          <div className="rounded-[14px] bg-bone p-5 text-[14px]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">What you need</span>
              <AvailabilityTag status="now" />
            </div>
            <ul className="mt-3 space-y-1.5 text-ash">
              <li>A Mac with Apple silicon, awake and on your home network.</li>
              <li>macOS 14 or newer, and Node 22 for the source path.</li>
              <li>About 1 GB to start. Photos and backups take what they take.</li>
            </ul>
            <p className="mt-3 text-ash">
              The radios, the router, the cameras and the screen arrive with the box.{" "}
              <Link href="/status" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
                What is real
              </Link>
            </p>
          </div>
        }
      >
        <Block id="try" title="Try it, with nothing installed">
          <p>
            The shortest honest path. It builds the Core and the dashboard from a checkout, keeps data in a folder you can delete, keeps the household key in that folder rather than your Keychain, and runs in the foreground until you press Ctrl-C. Nothing is installed system-wide and no login service is created.
          </p>
          <Code>{`git clone https://github.com/tars16775/woven.git
cd woven
packaging/try.sh --seed`}</Code>
          <p>
            Then open <span className="font-mono text-[13px]">http://localhost:4002</span>. With{" "}
            <span className="font-mono text-[13px]">--seed</span> there is a demo household to look around; without it you make your own house in about a minute: a name, your name, a passkey with Touch ID, and recovery codes to write down.
          </p>
        </Block>

        <Block id="install" title="Install it as a service">
          <p>
            When you want it to stay running: this fetches Node and the newest release into a folder of its own, installs a login service, and opens the setup page. Your data goes to{" "}
            <span className="font-mono text-[13px]">~/Library/Application Support/Woven</span> unless you point it elsewhere.
          </p>
          <Code>{`curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash`}</Code>
          <p>
            The installer verifies the release signature before it uses anything from it, and{" "}
            <span className="font-mono text-[13px]">woven update</span> keeps the previous release and rolls back on its own if a new one does not start.
            <Fn notes={notes} id="delivery" /> Until the first signed release is published this path needs a checkout; the section above works today.
          </p>
        </Block>

        <Block id="what-runs" title="What runs on a Mac today">
          <p>Every line here is built, tested and checkable on your own machine.</p>
          <ul>
            {runs.map((id) => (
              <li key={id}>
                <span className="font-medium text-ink">{claims[id].claim}</span>
                <Fn notes={notes} id={id} />
              </li>
            ))}
          </ul>
        </Block>

        <Block id="what-waits" title="What a Mac cannot do">
          <p>
            None of this is in the software yet, and the dashboard says so on the screen where you would expect to find it rather than showing you a picture of it.
          </p>
          <ul>
            {waits.map((id) => (
              <li key={id}>
                <span className="font-medium text-ink">{claims[id].claim}</span>
                <Fn notes={notes} id={id} />
              </li>
            ))}
          </ul>
          <p>When the box arrives the household moves with a snapshot: same core, same data, same receipts.</p>
        </Block>

        <Block id="backup" title="Back up other Macs to it">
          <p>
            Any other Mac in the house can back folders up to your Core with a small client and a token you make under Settings, Backup devices. It hashes what changed and sends only bytes the box does not already hold, over the household certificate.
          </p>
          <Code>{`curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash -s -- --client
woven-backup connect https://woven.local:4000 <token from Settings>
woven-backup run ~/Documents --watch     # --into and --namespace choose where`}</Code>
        </Block>

        <Block id="away" title="Reach it from anywhere">
          <p>
            Your Mac keeps no open ports. Set a relay address and the Core holds one outbound connection to it; a browser you paired at home reaches the house from anywhere, with every frame encrypted end to end under a key only that browser and the Core hold. The relay carries ciphertext and keeps nothing.
            <Fn notes={notes} id="remote" /> Pairing happens at home only, and any paired device can be revoked.
          </p>
          <Code>{`# in woven config, then: woven restart
WOVEN_RELAY="wss://your-relay.example.com"`}</Code>
        </Block>

        <Block id="command" title="The woven command">
          <Code>{`woven status      # running, where, how much space
woven logs        # follow the core
woven stop        # and start, restart
woven config      # data folder, ports, the second backup location, the relay
woven update      # the newest signed release; rolls back on its own if it does not start
woven rollback    # back to the release that ran before
woven uninstall   # removes the program; your data stays`}</Code>
          <p>
            There is also a switch in the dashboard.
            <Fn notes={notes} id="killSwitch" /> Off closes the Gate, drops the relay, stops every scheduled job and refuses every request but the switch itself, and it stays off across a restart.
          </p>
        </Block>
      </PageFrame>
      <Footnotes notes={notes} />
    </>
  );
}
