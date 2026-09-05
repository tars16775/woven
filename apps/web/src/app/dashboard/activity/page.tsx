import type { Metadata } from "next";
import { ActivityLedger } from "./ledger";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return <ActivityLedger />;
}
