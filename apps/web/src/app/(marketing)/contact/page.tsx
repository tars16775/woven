import type { Metadata } from "next";
import { Block, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach Woven.",
};

const lines = [
  ["General", email.hello, "Anything that does not fit below."],
  ["Founding Homes", email.founding, "Questions about the pilot before you apply."],
  ["Support", email.support, "You have a box and a question."],
  ["Security", email.security, "You found something. Thank you. We reply within two business days."],
  ["Developers", email.developers, "Agents, devices, integrations, the badge."],
  ["Press", email.press, "Interviews, images, facts."],
  ["Investors", email.founders, "The deck, the plan, the box in person."],
];

export default function ContactPage() {
  return (
    <PageFrame eyebrow="Contact" title="A person reads every one." intro="No forms, no ticket numbers. Pick the address that fits.">
      <Block title="Addresses">
        <ul className="divide-y divide-ink/8">
          {lines.map(([k, addr, d]) => (
            <li key={k} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
              <div className="text-[13px] font-medium uppercase tracking-[0.1em] text-ash sm:pt-1">{k}</div>
              <div>
                <a href={`mailto:${addr}`} className="text-[16px] font-medium">
                  {addr}
                </a>
                <p className="mt-0.5 text-ash">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </Block>
    </PageFrame>
  );
}
