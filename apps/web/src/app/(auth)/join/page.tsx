import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinForm } from "./form";

export const metadata: Metadata = { title: "Join a house", robots: { index: false } };

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
