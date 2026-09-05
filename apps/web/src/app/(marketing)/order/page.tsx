import type { Metadata } from "next";
import { Suspense } from "react";
import { Configurator } from "./configurator";

export const metadata: Metadata = {
  title: "Reserve",
  description:
    "Choose a Woven Core, storage and cloud plan, and hold your place. No card required today; the refundable deposit is taken when reservations open.",
};

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-bone" />}>
      <Configurator />
    </Suspense>
  );
}
