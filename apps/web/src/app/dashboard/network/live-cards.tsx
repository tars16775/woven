"use client";

import { useEffect, useState } from "react";
import { Card, Pill } from "@/components/dashboard/ui";
import { network as api, type NetworkView } from "@/lib/core/files";
import { explainAction } from "@/lib/core/actions";

/**
 * The Inside and Outside cards against a real Core (phase 43). On the Mac
 * the Outside is observed, not owned: the page says which parts are live
 * now and which arrive with the box.
 */
export function useNetworkScan(enabled: boolean) {
  const [view, setView] = useState<NetworkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .scan()
      .then((v) => alive && setView(v))
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { view, error };
}

export function LiveInside({ view, error }: { view: NetworkView | null; error: string | null }) {
  const router = view?.neighbours.find((n) => n.kind === "Router");
  const devices = view?.neighbours.filter((n) => n.kind !== "Router") ?? [];
  return (
    <Card dark title="Inside" action={view ? <Pill tone="dark">{view.mode === "owned" ? "Owned by the box" : "Observed on the Mac"}</Pill> : undefined}>
      {error ? (
        <p className="text-[14px] text-ask">{error}</p>
      ) : !view ? (
        <p className="text-[14px] text-ash-2">Looking around the network…</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium">{view.ssid ?? (view.interface ? `Wired · ${view.interface}` : "Not connected")}</span>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">
              <span className="orb" style={{ ["--orb" as string]: "6px" }} /> {view.addresses[0] ?? "no address"}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-ash-2">
            {view.mode === "observed"
              ? `This Mac sits on ${router?.name ?? "the household router"} at ${view.gateway ?? "?"}. The box will be the router; until then Woven only watches.`
              : "The box is the router. The Inside has no route to the internet."}
          </div>
          <ul className="mt-3 divide-y divide-white/8" data-testid="neighbours">
            {devices.length === 0 && <li className="py-2.5 text-[13px] text-ash-2">No other devices seen yet. The list fills as they talk.</li>}
            {devices.map((d) => (
              <li key={d.ip} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name ?? d.ip}</div>
                  <div className="text-[12px] text-ash-2">
                    {d.kind}
                    {d.name ? ` · ${d.ip}` : ""}
                    {d.services.length ? ` · ${d.services.slice(0, 3).join(", ")}` : ""}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-ash-2">{d.mac ? d.mac.slice(0, 8) : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ash-2">Names and kinds come from what devices announce (ARP and mDNS). Nothing is probed.</p>
        </>
      )}
    </Card>
  );
}

export function LiveOutside({ view }: { view: NetworkView | null }) {
  const router = view?.neighbours.find((n) => n.kind === "Router");
  return (
    <Card title="Outside · router">
      <div className="text-[14px]">
        <div className="flex items-center justify-between">
          <span className="font-medium">Internet</span>
          <Pill tone={view?.gateway ? "good" : "warn"}>{view?.gateway ? "Via your router" : "Unknown"}</Pill>
        </div>
        <div className="mt-0.5 text-[12px] text-ash">{view?.gateway ? `${router?.name ?? "Router"} at ${view.gateway}. Woven does not own it yet.` : "No default route right now."}</div>
      </div>
      <div className="mt-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">Arrives with the box</div>
      <ul className="mt-2 divide-y divide-ink/6">
        {[
          ["A second network", "The Outside on its own processor: Wi-Fi 7, wired ports, the internet for everyone."],
          ["Guest isolation", "Guests see the internet and nothing else."],
          ["Bedtime and priority rules", "Per device, per person, on the schedule you set."],
        ].map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <div>
              <div className="font-medium">{k}</div>
              <div className="text-[12px] text-ash">{v}</div>
            </div>
            <Pill tone="neutral">With the box</Pill>
          </li>
        ))}
      </ul>
    </Card>
  );
}
