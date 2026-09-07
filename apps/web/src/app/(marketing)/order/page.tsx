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
    <>
      {/* The configurator is a client component, so the page's heading and its
          one honest sentence are rendered here, on the server, where a crawler
          and a reader without JavaScript will both find them. */}
      <h1 className="sr-only">Reserve a Woven Core</h1>
      <p className="sr-only">
        Nothing is for sale yet. A reservation takes no money, is not an order, and the box is not
        built. Prices and dates are engineering targets.
      </p>
      <Suspense fallback={<div className="min-h-svh bg-bone" />}>
        <Configurator />
      </Suspense>
    </>
  );
}
