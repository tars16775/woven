"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoreDevice } from "@/components/core-device";
import { Button, Card, Meter, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { ConnectCore } from "@/components/dashboard/connect-core";
import { BackupsCard } from "@/components/dashboard/backups-card";
import { bytes, system, updates } from "@/lib/core/files";
import type { StorageHealth } from "@/lib/core/files";
import { explainAction } from "@/lib/core/actions";
import { identity, type Alert } from "@/lib/core/identity";
import { memoryLabel, storageLabel, temperatureLabel, useLiveCore } from "@/lib/core/live";
import { coreClient, useCore } from "@/lib/core/store";
import { PilotCard } from "@/components/dashboard/pilot-card";
import { PowerCard } from "@/components/dashboard/power-card";
import type { Integrity } from "@/lib/core/client";

type Phase = "ready" | "restarting";

export function CoreView() {
  const say = useToast();
  const [phase, setPhase] = useState<Phase>("ready");
  const [restarted, setRestarted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [integrity, setIntegrity] = useState<Integrity | "checking" | "failed" | null>(null);
  const timers = useRef<number[]>([]);
  const connection = useCore();
  const live = useLiveCore();
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    if (connection.phase !== "connected") return;
    let alive = true;
    identity
      .alerts()
      .then((a) => alive && setAlerts(a))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [connection.phase]);
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
    if (checking || connection.phase !== "connected") return;
    setChecking(true);
    {
      updates
        .check()
        .then((u) => {
          if (u.problem) say(`Could not check: ${u.problem}`);
          else if (u.newer) say(`Woven Core ${u.latest} is out${u.signed ? ", signed" : ""}. Update from Terminal with: woven update`);
          else say(`${u.current} is the newest release. Checked just now, through the Gate.`);
        })
        .catch((err: unknown) => say(explainAction(err)))
        .finally(() => setChecking(false));
    }
  };

  const restart = async () => {
    setConfirmRestart(false);
    if (connection.phase !== "connected") return;
    setPhase("restarting");
    {
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
    }
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

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Core"
        sub={
          restarting ? (
            <span className="text-ask">Restarting · back in a moment</span>
          ) : (
            <>
              <span data-testid="core-version">{live.version}</span> · <span data-testid="core-uptime">up {uptime}</span>
            </>
          )
        }
        action={
          <div className="flex gap-2">
            <Button onClick={checkForUpdates} disabled={checking || restarting || connection.phase !== "connected"} aria-busy={checking}>
              {checking ? "Checking…" : "Check for updates"}
            </Button>
            {connection.phase === "connected" && (
              <Button onClick={diagnostics} disabled={diagnosing || restarting} aria-busy={diagnosing} data-testid="diagnostics">
                {diagnosing ? "Writing…" : "Diagnostics"}
              </Button>
            )}
            <Button onClick={() => setConfirmRestart(true)} disabled={restarting || connection.phase !== "connected"}>
              {restarting ? "Restarting…" : "Restart"}
            </Button>
          </div>
        }
      />

      <ConnectCore />
      <PowerCard />

      {alerts.length > 0 && (
        <Card className="mb-4" title="Needs a look" action={<Pill tone={alerts.some((a) => a.level === "urgent") ? "warn" : "neutral"}>{alerts.length}</Pill>}>
          <ul className="divide-y divide-ink/6" data-testid="alerts">
            {alerts.map((a) => (
              <li key={a.id} className="py-2.5 text-[14px] first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Pill tone={a.level === "urgent" ? "warn" : a.level === "warn" ? "warn" : "neutral"}>{a.level}</Pill>
                  <span className="font-medium">{a.title}</span>
                </div>
                <div className="mt-0.5 text-[13px] text-ash">{a.detail} · runbooks in docs/runbooks.md</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card dark className="flex items-center justify-center py-8">
          <div className={restarting ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <CoreDevice
              label={live.connected ? live.model : "No Core"}
              state={restarting ? "Restarting." : live.connected ? "Ready." : "Not answering."}
              status={status}
              size="min(360px, 34vw, 58vw)"
            />
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

          {connection.phase === "connected" && <PilotCard />}
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
          {connection.phase === "connected" ? (
            <p className="text-[13px] text-ash">This machine&apos;s own drive. Bays, sleds and SMART per drive arrive with the box.</p>
          ) : (
            <p className="text-[13px] text-ash">No Core is answering, so there is nothing to read.</p>
          )}
        </Card>

        <Card
          title="Network"
          action={
            <Link href="/dashboard/network" className="text-[13px] font-medium text-ash hover:text-ink">
              Open Network
            </Link>
          }
        >
          <p className="text-[13px] text-ash">
            The Inside, the Outside and every Gate crossing, read from this Core. The second network arrives with the box.
          </p>
        </Card>
      </div>

      {connection.phase === "connected" && (
        <div className="mt-4">
          <BackupsCard />
        </div>
      )}

      <Card title="Updates" className="mt-4">
        {connection.phase === "connected" ? (
          <div className="flex flex-wrap items-center justify-between gap-4 text-[14px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{live.version}</span>
              </div>
              <div className="mt-1 text-[13px] text-ash">Releases are signed with the Woven release key and verified by the installer before anything is used. Check here, then update from Terminal with woven update; the previous release is kept and comes back on its own if the new Core does not answer within a minute.</div>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-ash">Connect a Core to see the release it is running.</p>
        )}
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

    </div>
  );
}
