import type { Metadata } from "next";
import { NetworkView } from "./view";

export const metadata: Metadata = { title: "Network" };

export default function NetworkPage() {
  return <NetworkView />;
}
