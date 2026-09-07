"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signIn, signOut, useSession } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";
import { Clock } from "@/components/clock";
import { startCore, useCore } from "@/lib/core/store";
import { identity, sessionRecord } from "@/lib/core/identity";
import { memoryLabel, storageLabel, temperatureLabel, useLiveCore } from "@/lib/core/live";
import { Dialog } from "./dialog";
import { ToastProvider } from "./toast";
import { ThemeStyle, useDocumentTheme, useTheme } from "./theme";
import { useGateOpen } from "./state";
import { SearchBox } from "./search-box";
import { NoCore } from "./no-core";
import { useT } from "@/lib/i18n";
import type { LedgerRow } from "@woven/schema";

/** Bytes that left through the Gate since midnight, from the receipts on hand. */
function bytesCrossedToday(rows: LedgerRow[]): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const since = midnight.toISOString();
  let n = 0;
  for (const r of rows) {
    if (r.type !== "gate.crossing" || r.occurredAt < since) continue;
    const observed = (r.payload as { observed?: { bytesOut?: unknown } }).observed;
    if (observed && typeof observed.bytesOut === "number") n += observed.bytesOut;
  }
  return n;
}
const formatBytes = (n: number) => (n < 1e3 ? `${n} bytes` : n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : `${(n / 1e6).toFixed(1)} MB`);

const items = [
  { href: "/dashboard", key: "nav.overview" },
  { href: "/dashboard/ask", key: "nav.ask" },
  { href: "/dashboard/files", key: "nav.files" },
  { href: "/dashboard/photos", key: "nav.photos" },
  { href: "/dashboard/home", key: "nav.home" },
  { href: "/dashboard/cameras", key: "nav.cameras" },
  { href: "/dashboard/tv", key: "nav.tv" },
  { href: "/dashboard/network", key: "nav.network" },
  { href: "/dashboard/agents", key: "nav.agents" },
  { href: "/dashboard/activity", key: "nav.activity" },
  { href: "/dashboard/privacy", key: "nav.privacy" },
  { href: "/dashboard/core", key: "nav.core" },
  { href: "/dashboard/settings", key: "nav.settings" },
] as const;

/**
 * The app shell: a quiet sidebar, a status line that always says where the
 * box stands, and the page. Everything the household owns is one click away.
 */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const { resolved } = useTheme();
  const gateOpen = useGateOpen();
  const connection = useCore();
  const live = useLiveCore();
  const { t } = useT();
  useDocumentTheme(resolved);

  // Look for the household's Core once the shell is on screen.
  useEffect(() => {
    startCore();
  }, []);

  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session, router, path]);

  const leave = () => {
    if (connection.phase === "connected" && session) void identity.logout();
    signOut();
    router.replace("/login");
  };

  // Away from home the tunnel's token is the session: reflect it locally so the shell knows who is here.
  useEffect(() => {
    if (connection.phase !== "connected" || !connection.remote || session) return;
    let alive = true;
    identity
      .session()
      .then((s) => {
        if (alive && s) signIn(sessionRecord(s, "remote"));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [connection, session]);

  // A Core-issued session is only as real as the cookie on the Core: check it once we are connected.
  useEffect(() => {
    if (connection.phase !== "connected" || !session) return;
    let alive = true;
    identity
      .session()
      .then((s) => {
        if (alive && s === null) signOut();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [connection.phase, session]);

  if (!session) {
    return (
      <div data-theme={resolved} data-dash-theme={resolved} className="flex min-h-svh items-center justify-center bg-bone">
        <ThemeStyle />
        <span className="orb" style={{ ["--orb" as string]: "14px" }} />
      </div>
    );
  }

  const nav = (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = it.href === "/dashboard" ? path === it.href : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`rounded-[8px] px-3 py-2 text-[14px] transition-colors ${
              active ? "bg-ink text-bone" : "text-ink/80 hover:bg-ink/6 hover:text-ink"
            }`}
          >
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );

  const connectionChip =
    connection.phase === "off" ? null : connection.phase === "connected" ? (
      <Link href="/dashboard/core" data-testid="core-connection" className="rounded-full bg-local-bg px-2.5 py-1 font-medium text-local">
        {t("shell.core", { host: live.host ?? "" })}
      </Link>
    ) : connection.phase === "searching" ? (
      <span data-testid="core-connection" className="rounded-full bg-chassis px-2.5 py-1 font-medium text-ink/70">
        {t("shell.looking")}
      </span>
    ) : (
      <Link href="/dashboard/core#connect" data-testid="core-connection" className="rounded-full bg-ask-bg px-2.5 py-1 font-medium text-ask">
        {t("shell.noCore")}
      </Link>
    );

  const connected = connection.phase === "connected";
  // What crossed today, summed from the receipts the shell already holds.
  const crossedToday = connected ? bytesCrossedToday(connection.rows) : 0;
  const gateChip = !connected ? null : gateOpen ? (
    <span className="rounded-full bg-local-bg px-2.5 py-1 font-medium text-local" data-testid="gate-chip">
      {crossedToday === 0 ? t("shell.gateNothing") : t("shell.gateBytes", { bytes: formatBytes(crossedToday) })}
    </span>
  ) : (
    <span className="rounded-full bg-ask-bg px-2.5 py-1 font-medium text-ask">{t("shell.gateClosed")}</span>
  );

  return (
    <ToastProvider>
      <div data-theme={resolved} data-dash-theme={resolved} className="flex min-h-svh bg-bone text-ink">
        <ThemeStyle />
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col border-r border-ink/8 px-4 py-5 lg:flex">
          <Link href="/" className="px-3" aria-label="Woven home">
            <Wordmark className="h-[18px]" />
          </Link>
          <div className="mt-6 px-3">
            <div className="text-[13px] font-medium">{session.household}</div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
              <span className="orb" style={{ ["--orb" as string]: "6px" }} />
              {connected ? t("shell.ready") : connection.phase === "searching" ? t("shell.looking") : t("shell.noCore")}
            </div>
          </div>
          <div className="mt-6">{nav}</div>
          <div className="mt-auto px-3 text-[11px] leading-relaxed text-ash">
            <div>{live.connected ? live.model : "No Core"}</div>
            <div>{live.version}</div>
            <div>
              Inside · <Clock />
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {connected && connection.status?.power?.power === "off" && (
            <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-[12px] text-bone" data-testid="power-banner" role="status">
              <span className="font-medium">The Core is switched off.</span>
              <span className="text-ash-2">Nothing runs, nothing leaves, nothing answers.</span>
              <Link href="/dashboard/core" className="font-medium underline underline-offset-2">
                Switch it on
              </Link>
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink/8 bg-bone/80 px-4 backdrop-blur-md lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-[8px] px-2.5 py-1.5 text-[14px] font-medium hover:bg-ink/6"
                aria-haspopup="dialog"
                aria-expanded={open}
              >
                {t("shell.menu")}
              </button>
              <Wordmark className="h-[16px]" />
            </div>
            <div className="hidden items-center gap-2 text-[13px] text-ash lg:flex">
              {connectionChip}
              {connectionChip && <span>·</span>}
              {gateChip}
              {gateChip && <span>·</span>}
              <span data-testid="core-memory">{memoryLabel(live)}</span>
              <span>·</span>
              <span data-testid="core-storage">{storageLabel(live)}</span>
              {live.temperatureC !== null && (
                <>
                  <span>·</span>
                  <span>{temperatureLabel(live)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {connected && <SearchBox />}
              <Link
                href="/dashboard/ask"
                className="hidden rounded-[8px] bg-white px-3 py-1.5 text-[13px] text-ash ring-1 ring-ink/8 hover:text-ink md:block"
              >
                {t("shell.ask")}
              </Link>
              <button type="button" onClick={leave} className="hidden text-[13px] font-medium text-ash hover:text-ink sm:block">
                {t("shell.signOut")}
              </button>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-bone"
                aria-label={session.name}
              >
                {session.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </header>

          {/* Mobile navigation drawer */}
          <Dialog open={open} onClose={() => setOpen(false)} variant="drawer" title={session.household} kicker={live.connected ? live.model : "No Core"}>
            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
              <span className="orb" style={{ ["--orb" as string]: "6px" }} />
              {!connected ? "Not answering" : gateOpen ? "Ready · inside" : "Gate closed"}
            </div>
            <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
            <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
              <button type="button" onClick={leave} className="text-[14px] font-medium text-ash hover:text-ink">
                Sign out
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[14px] font-medium text-ash hover:text-ink">
                Close
              </button>
            </div>
          </Dialog>

          <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            {/* Every screen below is drawn from a Core. When none is answering there is
                nothing to draw, so the page says so rather than inventing a household. */}
            {connected || path.startsWith("/dashboard/core") ? children : <NoCore />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
