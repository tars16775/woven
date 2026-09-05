import type { Metadata } from "next";
import Image from "next/image";
import { Block, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Press",
  description: "Boilerplate, facts and assets for writing about Woven.",
};

const facts = [
  ["Company", "Woven"],
  ["Product", "Woven Core, Core+ and Core Pro"],
  ["Assistant", "Tandem"],
  ["Category", "One box for the whole house"],
  ["Stage", "Pre-seed · Founding Homes pilot Q4 2026"],
  ["Pricing targets", "$899 · $1,499 · $2,499"],
  ["Contact", email.press],
];

const assets = [
  ["Woven Core+, front", "/media/box_front.png", 3733, 2933],
  ["Touchscreen, Ready", "/media/touch_ready.png", 2133, 1280],
  ["Touchscreen, Activity", "/media/touch_activity.png", 2133, 1280],
  ["What's in the box", "/media/in_the_box.png", 4267, 2400],
] as const;

export default function PressPage() {
  return (
    <PageFrame
      eyebrow="Press"
      title="Everything you need to write about the box."
      intro="Use the boilerplate as is, or ask for a person. Images are free to use with attribution."
      aside={
        <dl className="rounded-[14px] bg-bone p-5 text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-ink/8 py-2 last:border-b-0">
              <dt className="text-ash">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <Block title="Boilerplate">
        <p>
          Woven makes one box for the whole house. Files, photos, media, cameras, the smart home,
          the television and a private assistant called Tandem run on Woven Core, inside the
          house, on a computer that has no route to the internet. A second processor in the same
          box is the household&apos;s Wi-Fi 7 router, and a Gate between them forwards only what the
          household approves. A long-lived chassis
          keeps storage, radios and identity for a decade; a removable compute module
          upgrades the brain in sixty seconds. Woven is also the one place the household&apos;s AI
          agents are allowed to run, with scoped permissions and a receipt for everything
          they do.
        </p>
      </Block>

      <Block title="In one sentence">
        <p>
          Woven is the box that keeps your life inside the house, runs your home and your Wi-Fi,
          and shows you exactly what crossed the Gate.
        </p>
      </Block>

      <Block title="Images">
        <div className="grid gap-4 sm:grid-cols-2">
          {assets.map(([label, src, w, h]) => (
            <figure key={src} className="overflow-hidden rounded-[12px] bg-bone ring-1 ring-ink/5">
              <Image src={src} alt={label} width={w} height={h} className="h-auto w-full" sizes="(max-width: 640px) 100vw, 400px" />
              <figcaption className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <span>{label}</span>
                <a href={src} download className="font-medium text-ash hover:text-ink">
                  Download
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </Block>
    </PageFrame>
  );
}
