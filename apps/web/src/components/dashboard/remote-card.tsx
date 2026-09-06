"use client";

import { useEffect, useState } from "react";
import type { RemoteDevice, RemoteStatus } from "@woven/schema";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { explainAction, remote } from "@/lib/core/actions";
import { loadPairing, savePairing } from "@/lib/core/remote";
import { isRemote } from "@/lib/core/transport";

/**
 * Away from home (gap 21). Pairing happens here, on the home network: the
 * browser gets a frame key and a token, keeps them, and from then on can
 * reach the Core through the relay from anywhere, with every frame sealed
 * end to end. The relay never sees the household's data.
 */
export function RemoteCard() {
  const say = useToast();
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [paired, setPaired] = useState<ReturnType<typeof loadPairing>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const away = isRemote();

  const refresh = async () => {
    const [s, d] = await Promise.all([remote.status(), remote.devices()]);
    setStatus(s);
    setDevices(d);
  };

  useEffect(() => {
    let alive = true;
    Promise.all([remote.status(), remote.devices()])
      .then(([s, d]) => {
        if (!alive) return;
        setStatus(s);
        setDevices(d);
        setPaired(loadPairing());
      })
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, []);

  const pair = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const label = `${navigator.platform || "This device"} · ${new Date().toLocaleDateString()}`;
      const p = await remote.pair(label);
      savePairing(p);
      setPaired(p);
      await refresh();
      say("This browser can now reach the house from anywhere.");
    } catch (err) {
      setError(explainAction(err));
    } finally {
      setBusy(false);
    }
  };

  const forget = () => {
    savePairing(null);
    setPaired(null);
    say("This browser forgot the house. Revoke its device below to close the door on the Core side too.");
  };

  const revoke = async (d: RemoteDevice) => {
    try {
      await remote.revoke(d.id);
      if (paired?.deviceId === d.id) {
        savePairing(null);
        setPaired(null);
      }
      await refresh();
      say(`${d.label} can no longer reach the house from away.`);
    } catch (err) {
      say(explainAction(err));
    }
  };

  return (
    <Card
      title="Away from home"
      action={
        status ? (
          <Pill tone={!status.enabled ? "neutral" : status.connected ? "good" : "warn"}>
            <span data-testid="remote-state">{!status.enabled ? "Off" : status.connected ? "Relay attached" : "Relay not reached"}</span>
          </Pill>
        ) : undefined
      }
    >
      {status && !status.enabled ? (
        <p className="text-[14px] text-ash">
          Remote access is off on this Core. Set <span className="font-mono text-[13px]">WOVEN_RELAY</span> to your relay&apos;s address in <span className="font-mono text-[13px]">woven config</span> and restart. The Core keeps no open ports; it holds one outbound connection to the relay, and every frame is encrypted with a key that only this browser and the Core know.
        </p>
      ) : (
        <>
          <p className="text-[14px] text-ash">
            Pair a browser here, at home. From then on it reaches this Core from anywhere through the relay, end to end encrypted: the relay carries ciphertext and keeps nothing.
            {status?.lastError && !status.connected ? ` Last relay error: ${status.lastError}.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {paired ? (
              <>
                <Pill tone="good">This browser is paired</Pill>
                <Button kind="quiet" onClick={forget}>
                  Forget on this browser
                </Button>
              </>
            ) : away ? (
              <Pill tone="warn">Pairing happens at home</Pill>
            ) : (
              <Button kind="soft" onClick={pair} disabled={busy || !status?.enabled} data-testid="pair-remote">
                {busy ? "Pairing…" : "Pair this browser"}
              </Button>
            )}
          </div>
          {devices.length > 0 && (
            <ul className="mt-4 divide-y divide-ink/6" data-testid="remote-devices">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
                  <div>
                    <div className="font-medium">{d.label}</div>
                    <div className="text-[12px] text-ash">
                      Paired {new Date(d.createdAt).toLocaleDateString()}
                      {d.lastSeenAt ? ` · last seen ${new Date(d.lastSeenAt).toLocaleString()}` : " · never used from away"}
                      {paired?.deviceId === d.id ? " · this browser" : ""}
                    </div>
                  </div>
                  <Button kind="quiet" onClick={() => revoke(d)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-ask">
          {error}
        </p>
      )}
    </Card>
  );
}
