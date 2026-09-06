import type { Metadata } from "next";
import { AgentsView } from "./view";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return <AgentsView />;
}
