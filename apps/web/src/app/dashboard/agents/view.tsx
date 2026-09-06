"use client";

import { useSession } from "@/lib/auth";
import { useCore } from "@/lib/core/store";
import { AgentsLive } from "./live";
import { AgentsList } from "./list";

/** The honest page when a Core issued the session; the preview of what agents will look like otherwise. */
export function AgentsView() {
  const core = useCore();
  const session = useSession();
  if (core.phase === "connected" && session && !session.simulated) return <AgentsLive />;
  return <AgentsList />;
}
