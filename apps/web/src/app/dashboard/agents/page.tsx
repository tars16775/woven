import type { Metadata } from "next";
import { AgentsList } from "./list";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return <AgentsList />;
}
