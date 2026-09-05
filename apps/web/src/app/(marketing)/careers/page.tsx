import type { Metadata } from "next";
import { Block, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Careers",
  description: "The first ten people at Woven.",
};

const roles = [
  ["Product engineer, full-stack", "2", "The app, the web dashboard, the APIs behind them. You have shipped consumer software that people used every day."],
  ["AI and agents engineer", "2", "Tandem's planner, router and evals. You have run local models in production and measured them honestly."],
  ["Systems and edge AI engineer", "1", "Inference on unified-memory silicon, model serving, thermals. You know what a watt costs."],
  ["Embedded Linux engineer", "1", "The Core OS, signed A/B updates, Matter, Thread and Zigbee. You have bricked a device and made sure it never happened again."],
  ["Mobile engineer", "1", "The iOS app first, done properly. Cross-platform is a decision you will help make."],
  ["Electrical engineer", "1 or senior contract", "The P1 carrier board, power and RF integration, then the EVT backplane."],
  ["Industrial and mechanical designer", "Contract", "The chassis, the sled, the panel, the acoustics. Investor-quality by month six."],
  ["Product designer", "1", "Onboarding, approvals, the screen, the brand. Words are your material as much as pixels."],
  ["Security and privacy engineer", "Fractional, then full-time", "Threat model, key design, privacy review, the disclosure program."],
];

export default function CareersPage() {
  return (
    <PageFrame
      eyebrow="Careers"
      title="Ten people, one box, fifty homes."
      intro="We are hiring the founding team for a software-first hardware company. Remote-friendly, in-person for hardware. Send a link to something you built, not a cover letter."
      aside={
        <div className="rounded-[14px] bg-bone p-5 text-[14px]">
          <div className="font-medium">Apply</div>
          <p className="mt-2 text-ash">One email. Say which role, link the work, tell us what you would do in the first month.</p>
          <a href={`mailto:${email.jobs}`} className="mt-3 block font-medium underline decoration-amber decoration-2 underline-offset-4">
            {email.jobs}
          </a>
        </div>
      }
    >
      <Block title="Open roles">
        <ul className="divide-y divide-ink/8">
          {roles.map(([title, count, blurb]) => (
            <li key={title} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:gap-6">
              <div>
                <div className="text-[16px] font-medium">{title}</div>
                <p className="mt-1 text-ash">{blurb}</p>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ash sm:pt-1.5">{count}</div>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="How we work">
        <p>
          Software first, then steel. Every hardware milestone is gated by a demand milestone.
          Nothing is claimed that has not been measured. The model is never a security
          boundary. The appliance keeps working when the subscription stops.
        </p>
      </Block>
    </PageFrame>
  );
}
