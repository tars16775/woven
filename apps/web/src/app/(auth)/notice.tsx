"use client";

import { useEffect } from "react";
import { startCore, useCore } from "@/lib/core/store";
import { hostOf } from "@/lib/core/format";

/**
 * Above every sign-in form: whether there is a Core to talk to. Without one
 * the forms simulate sign-in on this device and say so, plainly.
 */
export function CoreNotice() {
  const core = useCore();
  useEffect(() => {
    startCore();
  }, []);
  if (core.phase === "off") return null;
  const connected = core.phase === "connected";
  return (
    <div role="note" aria-label={connected ? "Core notice" : "Preview notice"} className={`mb-7 flex gap-3 rounded-[10px] px-4 py-3 ring-1 ${connected ? "bg-local-bg ring-local/20" : "bg-ask-bg ring-ask/20"}`}>
      <span className={`mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full ${connected ? "bg-local" : "bg-ask"}`} aria-hidden />
      <p className="text-[13px] leading-relaxed text-ink">
        <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${connected ? "text-local" : "text-ask"}`}>{connected ? "Your Core" : core.phase === "searching" ? "Looking for your Core" : "Preview"}</span>
        <br />
        {connected
          ? `Connected to your Core at ${hostOf(core.url)}. Sign-in happens on the box; nothing is sent anywhere else.`
          : core.phase === "searching"
            ? "Checking the home network for your Core…"
            : "No Core found on this network. Sign-in is simulated on this device; nothing is sent anywhere."}
      </p>
    </div>
  );
}
