import type { Metadata } from "next";
import { HomeControls } from "./controls";

export const metadata: Metadata = { title: "Home" };

export default function DashboardHomePage() {
  return <HomeControls />;
}
