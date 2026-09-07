"use client";

import { Card, PageHeader, Pill } from "@/components/dashboard/ui";

/**
 * No camera capture exists on a Mac and none can be paired yet, so this page
 * says exactly that. It is the honest version of a screen the box will fill in.
 */
export function CamerasView() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Cameras"
        sub="Nothing is paired with this Core."
        action={
          <Pill tone="neutral">
            <span data-testid="cameras-none">No cameras yet</span>
          </Pill>
        }
      />
      <Card title="What this means">
        <p className="text-[14px] leading-relaxed">
          This Core has no camera capture. Detection on the box&apos;s own processor, clips that stay inside, and the pause switch arrive with the box and
          its radios; a Mac has none of that hardware, and nothing here will pretend otherwise. When cameras can be paired, this page fills in with the real
          ones.
        </p>
      </Card>
    </div>
  );
}
