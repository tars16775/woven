import type { Metadata } from "next";
import { PrivacyView } from "./view";

export const metadata: Metadata = { title: "Privacy" };

export default function DashboardPrivacyPage() {
  return <PrivacyView />;
}
