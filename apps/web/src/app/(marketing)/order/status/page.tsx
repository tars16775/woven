import type { Metadata } from "next";
import { Suspense } from "react";
import { ReservationList } from "./list";

export const metadata: Metadata = {
  title: "Your reservations",
  description: "The Woven reservations saved on this device, with their codes.",
  robots: { index: false },
};

export default function OrderStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-bone" />}>
      <ReservationList />
    </Suspense>
  );
}
