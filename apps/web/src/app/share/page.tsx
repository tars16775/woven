import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareLanding } from "./landing";

export const metadata: Metadata = { title: "A file shared from a Woven home", robots: { index: false, follow: false } };

/** The page a share link opens (gap 19): one file, from one house, until the link expires. */
export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareLanding />
    </Suspense>
  );
}
