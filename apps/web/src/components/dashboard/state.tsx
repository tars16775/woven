"use client";

import { gate as gateApi, explainAction } from "@/lib/core/actions";
import { coreState, refreshCore, useCore } from "@/lib/core/store";

/**
 * The Gate, as the shell and the Network page read and set it. There is no
 * local copy and no default: the answer comes from the Core that answered,
 * and with none the Gate is closed because nothing can cross a Gate that is
 * not running.
 */
export function useGateOpen(): boolean {
  const core = useCore();
  return core.phase === "connected" && core.gate?.state === "open";
}

/** Open or close the Gate. This is the gate.set action on the Core and leaves a receipt; resolves to an error message or null. */
export async function setGateOpen(open: boolean): Promise<string | null> {
  if (coreState().phase !== "connected") return "No Core is answering, so there is no Gate to open or close.";
  try {
    await gateApi.set(open);
    await refreshCore();
    return null;
  } catch (err) {
    return explainAction(err);
  }
}
