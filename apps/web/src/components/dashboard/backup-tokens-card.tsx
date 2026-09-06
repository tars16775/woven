"use client";

import { useEffect, useState } from "react";
import { Button, Card, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explain, identity, type DeviceToken } from "@/lib/core/identity";
import { useCore } from "@/lib/core/store";

/**
 * Backup devices (gap 20): a year-long token per machine that runs
 * woven-backup. Shown once; revoke it here and that machine stops the
 * moment its next request arrives.
 */
export function BackupTokensCard() {
  const say = useToast();
  const core = useCore();
  const [tokens, setTokens] = useState<DeviceToken[] | null>(null);
  const [label, setLabel] = useState("");
  const [made, setMade] = useState<{ label: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = core.phase === "connected" ? core.url : "https://woven.local:4000";

  const refresh = () =>
    identity
      .tokens()
      .then(setTokens)
      .catch((err: unknown) => setError(explain(err)));

  useEffect(() => {
    let alive = true;
    identity
      .tokens()
      .then((t) => alive && setTokens(t))
      .catch((err: unknown) => alive && setError(explain(err)));
    return () => {
      alive = false;
    };
  }, []);

  const make = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const t = await identity.newToken(label.trim());
      setMade({ label: t.label ?? label.trim(), token: t.token });
      setLabel("");
      await refresh();
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (t: DeviceToken) => {
    try {
      await identity.revokeToken(t.id);
      say(`${t.label ?? "That device"} can no longer back up here.`);
      await refresh();
    } catch (err) {
      say(explain(err));
    }
  };

  const copy = async () => {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(`woven-backup connect ${origin} ${made.token}`);
      say("Copied. Paste it in Terminal on that Mac.");
    } catch {
      say("Select the command and copy it.");
    }
  };

  return (
    <Card title="Backup devices">
      <p className="text-[13px] text-ash">Other Macs back up folders to this Core with the woven-backup command and a token made here. Each token is one machine; revoke it and that machine stops.</p>
      {tokens === null ? (
        <p className="mt-3 text-[13px] text-ash">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="mt-3 text-[14px] text-ash" data-testid="no-tokens">
          No backup devices yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/6" data-testid="tokens">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px] first:pt-0 last:pb-0">
              <div>
                <div className="font-medium">{t.label ?? "Device"}</div>
                <div className="text-[12px] text-ash">
                  Made {new Date(t.createdAt).toLocaleDateString()} · good until {new Date(t.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <Button kind="quiet" onClick={() => revoke(t)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void make();
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Which Mac? e.g. Maya's laptop" aria-label="Device name" className="min-w-0 flex-1 rounded-[8px] bg-bone px-3 py-2 text-[14px] ring-1 ring-ink/8" />
        <Button kind="soft" type="submit" disabled={!label.trim() || busy} data-testid="new-token">
          {busy ? "Making…" : "New token"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-ask">
          {error}
        </p>
      )}

      <Dialog open={made !== null} onClose={() => setMade(null)} kicker="Shown once" title={made ? `Connect ${made.label}` : ""} size="md">
        <p className="mt-2 text-[14px] text-ash">Install the client on that Mac, then paste this in its Terminal. The token is not stored on the box in a readable form and will not be shown again.</p>
        <pre className="mt-3 overflow-x-auto rounded-[8px] bg-ink px-3 py-3 font-mono text-[12px] leading-relaxed text-bone" data-testid="token-command">
          {`curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash -s -- --client\nwoven-backup connect ${origin} ${made?.token ?? ""}\nwoven-backup run ~/Documents --watch`}
        </pre>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={copy} data-autofocus>
            Copy the connect command
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setMade(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
      <Pill tone="neutral">Tokens last a year</Pill>
    </Card>
  );
}
