import type { Metadata } from "next";
import Link from "next/link";
import { Block, Code, PageFrame } from "@/components/page-frame";

export const metadata: Metadata = {
  title: "Woven on your Mac",
  description: "Run a Woven Core on a Mac you already own: one command, a service that starts at login, your data in a folder you choose. The same software the box runs.",
};

export default function MacPage() {
  return (
    <PageFrame
      eyebrow="Woven on your Mac · preview"
      title="The box is coming. The software is here."
      intro="A Woven Core runs on any Mac with Apple silicon: the same core, the same dashboard, the same receipts. One command installs it as a service that starts when you log in. Your data lives in a folder on your Mac, or on a drive you point it at."
      aside={
        <div className="rounded-[14px] bg-bone p-5 text-[14px]">
          <div className="font-medium">What you need</div>
          <ul className="mt-2 space-y-1.5 text-ash">
            <li>A Mac with Apple silicon on your home network, awake and plugged in.</li>
            <li>macOS 14 or newer. Nothing else to install.</li>
            <li>About 1 GB to start; photos and backups take what they take.</li>
          </ul>
          <p className="mt-3 text-ash">
            The box adds the radios, the Outside processor and the screen.{" "}
            <Link href="/core" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              See the box
            </Link>
          </p>
        </div>
      }
    >
      <Block id="install" title="Install">
        <p>Open Terminal and paste this. It fetches Node and the newest release into a folder of its own, installs a login service, and opens the setup page.</p>
        <Code>{`curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash`}</Code>
        <p>
          Then make your house: a name, your name, a passkey with Touch ID, and eight recovery codes to write down. That is the whole setup. Other devices in the house open{" "}
          <span className="font-mono text-[13px]">http://woven.local:4001</span> once to trust the household certificate, then use{" "}
          <span className="font-mono text-[13px]">https://woven.local:4000</span>.
        </p>
      </Block>

      <Block id="what-runs" title="What runs, and where">
        <p>
          A single process on your Mac, listening only on your home network. Its only way out is the Gate, a second process on the same machine with an allow list and a receipt for every crossing. The dashboard is served by the core itself, so there is one address and nothing in between.
        </p>
        <ul>
          <li>Program and logs: <span className="font-mono text-[13px]">~/.woven</span></li>
          <li>Your data: <span className="font-mono text-[13px]">~/Library/Application Support/Woven</span>, or the drive you set in <span className="font-mono text-[13px]">woven config</span></li>
          <li>Snapshots nightly, with a second location when you name one</li>
        </ul>
      </Block>

      <Block id="backup" title="Back up other Macs to it">
        <p>
          Any other Mac in the house can back folders up to your Core with a small client and a token you make under Settings, Backup devices. It hashes what changed and sends only bytes the box does not already hold, over the household certificate.
        </p>
        <Code>{`curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash -s -- --client
woven-backup connect https://woven.local:4000 <token from Settings>
woven-backup run ~/Documents --watch     # keeps watching; --into and --namespace to choose where`}</Code>
      </Block>

      <Block id="away" title="Reach it from anywhere">
        <p>
          Your Mac keeps no open ports. When you set a relay address, the Core holds one outbound connection to it, and a browser you paired at home (Settings, Away from home) can reach the house from anywhere. Every frame is encrypted end to end with a key only that browser and the Core know; the relay carries ciphertext and keeps nothing. Pairing only happens on the home network, and any paired device can be revoked from Settings.
        </p>
        <Code>{`# in woven config, then: woven restart
WOVEN_RELAY="wss://relay.woventechnology.com"`}</Code>
      </Block>

      <Block id="command" title="The woven command">
        <Code>{`woven status      # running, where, how much space
woven logs        # follow the core
woven stop        # and start, restart
woven config      # data folder, ports, the second backup location
woven update      # the newest release, data untouched
woven uninstall   # removes the program; your data stays`}</Code>
      </Block>

      <Block id="honest" title="What the Mac cannot do yet">
        <p>
          The Mac observes your network; it is not the router, so the Outside, guest isolation and bedtime rules arrive with the box. Radios (Thread, Zigbee) need the box or a small bridge. Everything else in the dashboard is real: files, photos and search, the home with routines and approvals, the TV, memory, the ledger.
        </p>
        <p>
          When the box arrives, the household moves with a snapshot: same core, same data, same receipts.
        </p>
      </Block>
    </PageFrame>
  );
}
