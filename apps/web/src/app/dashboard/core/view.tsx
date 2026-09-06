"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoreDevice } from "@/components/core-device";
import { Button, Card, Meter, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { useGateOpen } from "@/components/dashboard/state";
import { core, household } from "@/lib/dashboard/data";
import { ConnectCore } from "@/components/dashboard/connect-core";
import { BackupsCard } from "@/components/dashboard/backups-card";
import { bytes, system } from "@/lib/core/files";
import type { StorageHealth } from "@/lib/core/files";
import { explainAction } from "@/lib/core/actions";
import { memoryLabel, storageLabel, temperatureLabel, useLiveCore } from "@/lib/core/live";
import { coreClient, useCore } from "@/lib/core/store";
import type { Integrity } from "@/lib/core/client";

const upgradeSteps = [
  ["Back up", "Tonight's backup covers everything on the drives. Nothing to do; the household state lives on the chassis, not the module."],
  ["Order the module", "Compute Module B1 ships in the same sled format. Your order is tied to this chassis so it arrives pre-trusted."],
  ["Power down from here", "Restart is not enough; the Power down step on this page parks the drives and releases the module."],
  ["Swap the sled", "Slide the A1 out from the back, click the B1 in. No tools, no cables."],
  ["Power on", "The chassis attests the new module, restores pairings and permissions, and is ready in about four minutes."],
];

type Phase = "ready" | "restarting";

export function CoreView() {
  const say = useToast();
  const gateOpen = useGateOpen();
  const [phase, setPhase] = useState<Phase>("ready");
  const [restarted, setRestarted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [integrity, setIntegrity] = useState<Integrity | "checking" | "failed" | null>(null);
  const timers = useRef<number[]>([]);
  const connection = useCore();
  const live = useLiveCore();
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  useEffect(() => {
    if (connection.phase !== "connected") return;
    let alive = true;
    system
      .storage()
      .then((s) => alive && setStorage(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [connection.phase]);

  const diagnostics = async () => {
    if (diagnosing) return;
    setDiagnosing(true);
    try {
      const r = await system.diagnostics();
      say(`Diagnostics written to ${r.dir} (${r.files.length} files, names and addresses scrubbed).`);
    } catch (err) {
      say(explainAction(err));
    } finally {
      setDiagnosing(false);
    }
  };

  // Clear pending timers if the page unmounts mid-restart.
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const checkForUpdates = () => {
    if (checking) return;
    setChecking(true);
    later(1100, () => {
      setChecking(false);
      say(`${core.version} is the latest on the ${core.update.channel} channel. Checked just now.`);
    });
  };

  const restart = async () => {
    setConfirmRestart(false);
    setPhase("restarting");
    if (connection.phase === "connected") {
      // The core exits with the restart code; its supervisor starts it again; we wait for health.
      try {
        await system.restart();
      } catch (err) {
        setPhase("ready");
        say(explainAction(err));
        return;
      }
      const client = coreClient();
      const started = Date.now();
      const poll = async () => {
        try {
          const r = await fetch(`${client?.base ?? ""}/v1/health`, { cache: "no-store" });
          if (r.ok && Date.now() - started > 1500) {
            setPhase("ready");
            setRestarted(true);
            say("The Core is back.");
            return;
          }
        } catch {}
        if (Date.now() - started < 60_000) later(1000, () => void poll());
        else {
          setPhase("ready");
          say("The Core did not come back within a minute. Check the Start command on the Mac.");
        }
      };
      later(1500, () => void poll());
      return;
    }
    later(3000, () => {
      setPhase("ready");
      setRestarted(true);
      say("The Core is back. Cameras, home and Tandem resumed.");
    });
  };

  const verifyLedger = async () => {
    const client = coreClient();
    if (!client || integrity === "checking") return;
    setIntegrity("checking");
    try {
      setIntegrity(await client.integrity());
    } catch {
      setIntegrity("failed");
    }
  };

  const restarting = phase === "restarting";
  const uptime = restarted ? "just now" : live.uptime;
  const status = restarting
    ? "Restarting · locks stay locked"
    : live.temperatureC === null
      ? `${live.model} · ${live.fan}`
      : `${live.model} · ${live.temperatureC} °C · ${live.fan}`;

  const netRows = [
    { label: core.network.inside.label, value: core.network.inside.value },
    { label: core.network.outside.label, value: core.network.outside.value, second: core.network.outside.second },
    { label: core.network.gate.label, value: gateOpen ? core.network.gate.value : core.network.gate.closed },
    { label: core.network.remote.label, value: core.network.remote.value },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Core"
        sub={
          restarting ? (
            <span className="text-ask">Restarting · back in a moment</span>
          ) : (
            <>
              <span data-testid="core-version">{live.version}</span> · <span data-testid="core-uptime">up {uptime}</span> · {core.update.channel} channel
            </>
          )
        }
        action={
          <div className="flex gap-2">
            <Button onClick={checkForUpdates} disabled={checking || restarting} aria-busy={checking}>
              {checking ? "Checking…" : "Check for updates"}
            </Button>
            {connection.phase === "connected" && (
              <Button onClick={diagnostics} disabled={diagnosing || restarting} aria-busy={diagnosing} data-testid="diagnostics">
                {diagnosing ? "Writing…" : "Diagnostics"}
              </Button>
            )}
            <Button onClick={() => setConfirmRestart(true)} disabled={restarting}>
              {restarting ? "Restarting…" : "Restart"}
            </Button>
          </div>
        }
      />

      <ConnectCore />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card dark className="flex items-center justify-center py-8">
          <div className={restarting ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CoreDevice label={household.screenLabel} state={restarting ? "Restarting." : "Ready."} status={status} size="min(360px, 34vw, 58vw)" />
          </div>
        </Card>

        <div className="grid gap-4">
          <Card
            title="Right now"
            action={
              restarting ? <Pill tone="warn">Restarting</Pill> : live.connected ? <Pill tone="good">Ready · {live.host}</Pill> : <Pill tone="good">Ready</Pill>
            }
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px] sm:grid-cols-4">
              <div>
                <dt className="text-ash">{live.connected ? "Machine" : "Model"}</dt>
                <dd className="mt-0.5 font-medium" data-testid="core-model">
                  {live.model}
                </dd>
                {live.cpu && <dd className="mt-0.5 text-[12px] text-ash">{live.cpu}</dd>}
              </div>
              <div>
                <dt className="text-ash">Memory</dt>
                <dd className="mt-0.5 font-medium">{memoryLabel(live)}</dd>
                <Meter value={restarting ? live.memory.total * 0.06 : live.memory.used} max={live.memory.total} className="mt-2" />
              </div>
              <div>
                <dt className="text-ash">Storage</dt>
                <dd className="mt-0.5 font-medium">{storageLabel(live)}</dd>
                <Meter value={live.storage.usedBytes} max={live.storage.totalBytes} className="mt-2" />
              </div>
              <div>
                <dt className="text-ash">Temperature</dt>
                <dd className="mt-0.5 font-medium">
                  {live.temperatureC === null ? "Not reported" : `${temperatureLabel(live)} · ${live.fan}`}
                </dd>
                {live.connected && live.temperatureC === null && <dd className="mt-0.5 text-[12px] text-ash">This machine keeps its sensors to itself.</dd>}
              </div>
            </dl>
          </Card>

          {connection.phase === "connected" && (
            <Card
              title="Ledger"
              action={
                <Button kind="soft" onClick={verifyLedger} disabled={integrity === "checking"} aria-busy={integrity === "checking"}>
                  {integrity === "checking" ? "Verifying…" : "Verify the ledger"}
                </Button>
              }
            >
              <div className="text-[14px]" data-testid="ledger-integrity">
                {integrity === null || integrity === "checking" ? (
                  <span className="text-ash">Every receipt is chained to the one before it. Verify walks the whole chain and recomputes every hash.</span>
                ) : integrity === "failed" ? (
                  <span className="text-ask">The Core did not answer the check.</span>
                ) : integrity.ok ? (
                  <>
                    <span className="font-medium">Chain intact · {integrity.rows} rows</span>
                    <span className="block mt-1 font-mono text-[11px] text-ash">head {integrity.head?.slice(0, 16) ?? "—"}…</span>
                  </>
                ) : (
                  <span className="text-ask">
                    Chain broken at row {integrity.brokenAtSeq}: {integrity.reason}
                  </span>
                )}
              </div>
              {live.dataRoot && <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">Data at {live.dataRoot}</div>}
            </Card>
          )}

          <Card title="Compute module">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-medium">{core.module.name}</div>
                <div className="mt-0.5 text-[13px] text-ash">
                  {core.module.soc} · {core.module.memory}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ash">Installed {core.module.installed} · attested</div>
              </div>
              <Button kind="soft" onClick={() => setUpgrade(true)}>
                Prepare an upgrade
              </Button>
            </div>
            <p className="mt-3 text-[13px] text-ash">
              Household data, device pairings, permissions and automations live on the chassis. Swapping the module does not touch them.
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="Drives" id="drives">
          {storage && (
            <div className="mb-3 border-b border-ink/6 pb-3" data-testid="storage">
              <div className="flex items-center justify-between text-[14px]">
                <span className="font-medium">{storage.volume ?? "Data volume"}</span>
                <span className="text-ash">{bytes(storage.totalBytes)}</span>
              </div>
              <Meter value={storage.usedBytes} max={Math.max(1, storage.totalBytes)} className="mt-2" />
              <div className="mt-1 text-[12px] text-ash">
                {storage.filesystem ?? "filesystem"} · {bytes(storage.freeBytes)} free · SMART {storage.smart === "verified" ? "verified" : storage.smart === "failing" ? "FAILING" : "not reported"} · {storage.medium === "unknown" ? "medium unknown" : storage.medium.toUpperCase()}
              </div>
            </div>
          )}
          <ul className="divide-y divide-ink/6">
            {core.drives.map((d) => (
              <li key={d.bay} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-medium">{d.bay}</span>
                  <span className="text-ash">{d.size}</span>
                </div>
                {d.size !== "Empty" ? (
                  <>
                    <Meter value={d.used} max={2} className="mt-2" />
                    <div className="mt-1 text-[12px] text-ash">
                      Health {d.health} · {d.used} TB used
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-[12px] text-ash">Tool-less sled. Add up to 8 TB.</div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Radios">
          <ul className="divide-y divide-ink/6">
            {core.radios.map((r) => (
              <li key={r.name} className="flex items-center justify-between py-2.5 text-[14px] first:pt-0 last:pb-0">
                <span className="font-medium">{r.name}</span>
                <span className="text-[13px] text-ash">{r.state}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Network"
          action={
            <Link href="/dashboard/network" className="text-[13px] font-medium text-ash hover:text-ink">
              Open Network
            </Link>
          }
        >
          <ul className="divide-y divide-ink/6 text-[14px]">
            {netRows.map((r) => (
              <li key={r.label} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="font-medium">{r.label}</span>
                <span className="text-right text-[13px] text-ash">
                  <span className="block">{r.value}</span>
                  {r.second && <span className="block">{r.second}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {connection.phase === "connected" && (
        <div className="mt-4">
          <BackupsCard />
        </div>
      )}

      <Card title="Updates" className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[14px]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{core.version}</span>
              <Pill tone="good">Up to date</Pill>
            </div>
            <div className="mt-1 text-[13px] text-ash">
              Installed {core.update.lastInstalled} · slot {core.update.slot} · signed, rolls back on its own
            </div>
          </div>
          <div className="text-[13px] text-ash">Security support until at least 2031</div>
        </div>
      </Card>

      <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)} kicker="Class C · about a minute" title="Restart the Core?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          Cameras, home control and Tandem pause while it comes back. Locks stay locked, routines resume, and nothing crosses the Gate in between.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={restart} data-autofocus>
            Restart now
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirmRestart(false)}>
            Not now
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={upgrade} onClose={() => setUpgrade(false)} kicker={`${core.module.name} · installed ${core.module.installed}`} title="Upgrading the compute module" size="md">
        <ol className="mt-4 space-y-3">
          {upgradeSteps.map(([k, v], i) => (
            <li key={k} className="grid grid-cols-[28px_1fr] gap-3 text-[14px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bone font-mono text-[12px] text-ash">{i + 1}</span>
              <div>
                <div className="font-medium">{k}</div>
                <div className="mt-0.5 text-[13px] text-ash">{v}</div>
              </div>
            </li>
          ))}
        </ol>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={() => setUpgrade(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
