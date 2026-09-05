import type { Metadata } from "next";
import { Shell } from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard | Woven" },
  robots: { index: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <Shell>{children}</Shell>;
}
