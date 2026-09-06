import type { Metadata } from "next";
import { Shell } from "@/components/dashboard/shell";
import { Pwa } from "@/components/pwa";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard | Woven" },
  robots: { index: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <Pwa />
      <Shell>{children}</Shell>
    </>
  );
}
