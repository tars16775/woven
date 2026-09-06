"use client";

import { useEffect, useState } from "react";
import type { PushSubscriptionView } from "@woven/schema";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { useToast } from "@/components/dashboard/toast";
import { actions, describe, explainAction, gate, push } from "@/lib/core/actions";
import { identity } from "@/lib/core/identity";
import { useSession } from "@/lib/auth";

function keyBytes(b64u: string): Uint8Array {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
function b64u(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Notifications (gap 17). This device subscribes with its browser's push
 * service; the Core keeps the subscription sealed and sends through the
 * Gate. The push service's host must be on the allow list, which the owner
 * confirms with a passkey the first time.
 */
export function NotificationsCard() {
  const say = useToast();
  const session = useSession();
  const [subs, setSubs] = useState<PushSubscriptionView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const refresh = () =>
    push
      .list()
      .then(setSubs)
      .catch((err: unknown) => setError(explainAction(err)));

  useEffect(() => {
    let alive = true;
    push
      .list()
      .then((s) => alive && setSubs(s))
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, []);

  const allowHost = async (host: string) => {
    const status = await gate.status();
    if (status.allowList.some((a) => (a.startsWith("*.") ? host === a.slice(2) || host.endsWith(a.slice(1)) : a === host))) return;
    if (session?.role !== "owner") throw new Error(`The owner has to allow ${host} on the Gate first (Settings, on the owner's device).`);
    const prepared = await actions.prepare({ capability: "gate.allow", target: "gate", parameters: { host, reason: "notifications" } });
    if (prepared.status !== "prepared") throw new Error(describe(prepared));
    const assertion = await identity.assert(session.email || undefined);
    const approved = await actions.approve(prepared.id, assertion);
    if (approved.status !== "approved") throw new Error(describe(approved));
    const done = await actions.execute(prepared.id);
    if (done.status !== "succeeded") throw new Error(describe(done));
  };

  const turnOn = async () => {
    if (busy || !supported) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed in the browser.");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await push.vapid();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
      const host = new URL(sub.endpoint).host;
      await allowHost(host);
      await push.subscribe({ endpoint: sub.endpoint, keys: { p256dh: b64u(sub.getKey("p256dh")), auth: b64u(sub.getKey("auth")) }, label: navigator.platform || "This device" });
      await refresh();
      say("This device will hear about anything urgent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : explainAction(err));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      const r = await push.test();
      say(r.skipped ? `Not sent: ${r.skipped}.` : r.sent ? `Sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}.` : `Nothing sent (${r.failed} failed, ${r.dropped} dropped).`);
    } catch (err) {
      say(explainAction(err));
    }
  };

  const remove = async (s: PushSubscriptionView) => {
    try {
      await push.remove(s.id);
      await refresh();
    } catch (err) {
      say(explainAction(err));
    }
  };

  return (
    <Card title="Notifications" action={subs && subs.length > 0 ? <Pill tone="good">{subs.length} {subs.length === 1 ? "device" : "devices"}</Pill> : undefined}>
      <p className="text-[13px] text-ash">Urgent alerts about the box reach your devices even when the dashboard is closed. Each message is encrypted for one device and leaves through the Gate with a receipt; the push service sees nothing readable.</p>
      {!supported && <p className="mt-2 text-[13px] text-ash">This browser cannot receive push notifications. On iPhone, add the dashboard to the Home Screen first.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button kind="soft" onClick={turnOn} disabled={busy || !supported} data-testid="notify-on">
          {busy ? "Asking the browser…" : "Turn on for this device"}
        </Button>
        {subs && subs.length > 0 && (
          <Button kind="quiet" onClick={test}>
            Send a test
          </Button>
        )}
      </div>
      {subs && subs.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/6" data-testid="push-devices">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
              <div>
                <div className="font-medium">{s.label ?? "Device"}</div>
                <div className="text-[12px] text-ash">
                  via {s.host} · {s.lastSentAt ? `last sent ${new Date(s.lastSentAt).toLocaleString()}` : "nothing sent yet"}
                  {s.failures ? ` · ${s.failures} failed` : ""}
                </div>
              </div>
              <Button kind="quiet" onClick={() => remove(s)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-ask">
          {error}
        </p>
      )}
    </Card>
  );
}
