import type { Metadata } from "next";
import { Block, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy & Legal",
  description: "Privacy policy, terms, warranty and how Woven governs its claims.",
};

export default function LegalPage() {
  return (
    <PageFrame
      eyebrow="Privacy & Legal"
      title="Short, because the product does most of the work."
      intro={
        <>
          These documents are drafts prepared for the Founding Homes pilot and have not yet
          been reviewed by counsel. They will be replaced before any commercial sale.
        </>
      }
      aside={
        <nav className="rounded-[14px] bg-bone p-5 text-[14px]" aria-label="On this page">
          <div className="font-medium">On this page</div>
          <ul className="mt-2 space-y-1.5 text-ash">
            {[
              ["#privacy", "Privacy policy"],
              ["#terms", "Terms"],
              ["#warranty", "Warranty and returns"],
              ["#claims", "How we govern claims"],
            ].map(([h, l]) => (
              <li key={h}>
                <a href={h} className="hover:text-ink">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      }
    >
      <Block id="privacy" title="Privacy policy">
        <p>
          <strong>Today, in plain terms.</strong> Woven runs no service that holds anything of
          yours. There are no accounts, no cloud storage, no relay we operate and no telemetry
          being collected, because none of it has been built or deployed. If you run a Core on your
          own Mac, everything it holds is on your machine and reaches us in no way at all. The rest
          of this policy describes what the box and its optional services will do, and it takes
          effect when they exist.
        </p>
        <p>
          <strong>What stays on the box.</strong> Voice and conversations, home control and
          automations, cameras and clips, and your files, photos and memory are processed and
          stored on Woven Core. Woven does not receive them.
        </p>
        <p>
          <strong>What a Gate crossing sends.</strong> A task written by Tandem and the minimum
          context it needs, after you approve it. Names, files, photos, device names and
          history are excluded. Each crossing is recorded on the box with its contents.
        </p>
        <p>
          <strong>What a Woven service would hold.</strong> Nothing yet: no such service is
          running. When one is, it holds your account, the relay used for remote access, and update
          metadata, plus encrypted off-site backup if you turn it on. The relay is designed so that
          it cannot read what passes through it: your browser and your box encrypt every frame
          end to end under a key exchanged at home, and the relay carries ciphertext and keeps
          nothing.
        </p>
        <p>
          <strong>Telemetry.</strong> None is collected. The software can send one nightly line
          saying its version and how long it has been running, and that is off unless you turn it
          on; it goes out through the Gate like anything else and leaves a receipt you can read.
          Content is never part of it.
        </p>
        <p>
          <strong>Your rights.</strong> Export, delete and correct from the app; all three are
          built and running today. Deleting a memory blanks it immediately and it is gone from the
          next snapshot. Deleting your account leaves only a ledger row saying it happened. There is
          no cloud data to delete, because there is none.
        </p>
        <p>
          <strong>No advertising.</strong> Woven does not sell or share household data and
          does not run an advertising business.
        </p>
        <p>
          <strong>This website.</strong> It sets no cookies and runs no analytics. Signing in
          to the dashboard stores a session in your own browser and nowhere else.
        </p>
      </Block>

      <Block id="terms" title="Terms">
        <p>
          Nothing is for sale. A reservation takes no money, is not an order and creates no
          obligation on either side; today it is a note kept in your own browser. When reservations
          open, deposits are refundable and the balance is charged only when you confirm
          at shipment. Prices and specifications shown before shipment are targets and may
          change; you can cancel for a full refund if they do.
        </p>
        <p>
          Gate crossings are an optional subscription after the first year. Ending it does
          not change what the box can do inside. Woven will publish a security support period for each hardware
          generation before commercial sale and will provide a final security release at end
          of support.
        </p>
      </Block>

      <Block id="warranty" title="Warranty and returns">
        <p>
          Two years on the chassis and the compute module, covering defects in materials and
          workmanship. Drives and fans are user-serviceable and covered for the same period.
          Returns within thirty days of delivery for any reason.
        </p>
        <p>
          Opening the service panel to swap a module or a drive does not void anything. It is
          what the panel is for.
        </p>
      </Block>

      <Block id="claims" title="How we govern claims">
        <p>
          Every performance, privacy, compatibility, model, power and security claim on this
          site has an owner, evidence and a review date. Reference-design targets are
          labelled as targets. Inside percentages on rendered screens are examples until pilot
          homes report measured figures. Your own box shows your own.
        </p>
        <p>
          <strong>Claims.</strong> A claims register lists every public claim on this site,
          where it appears, the evidence it needs, who owns it and when it is next reviewed.
          It is reviewed before each release, and a claim without evidence comes off the site.
        </p>
        <p>
          We say inside first, not &ldquo;everything stays inside.&rdquo; We say a crossing
          when needed and permitted, not &ldquo;no cloud.&rdquo; If you find a claim we cannot
          support, write to {email.legal} and we will fix the claim, not the wording.
        </p>
      </Block>
    </PageFrame>
  );
}
