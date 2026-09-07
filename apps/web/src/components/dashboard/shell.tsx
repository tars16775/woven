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
import { TourBar } from "./tour";
import { DemoBanner } from "./demo-banner";
import { Avatar } from "./ui";
import { roomIcon, type RoomHref } from "./icons";
import { useT, type MessageKey } from "@/lib/i18n";
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

/**
 * The rooms, grouped the way a person thinks about their house rather than
 * the way the software is layered. Thirteen flat entries were a list to read;
 * five short groups are a place to look.
 */
type Room = { href: RoomHref; key: MessageKey };
type Group = { key?: MessageKey; rooms: Room[] };

const groups: Group[] = [
  {
    rooms: [
      { href: "/dashboard", key: "nav.overview" },
      { href: "/dashboard/ask", key: "nav.ask" },
    ],
  },
  {
    key: "nav.group.yours",
    rooms: [
      { href: "/dashboard/files", key: "nav.files" },
      { href: "/dashboard/photos", key: "nav.photos" },
      { href: "/dashboard/tv", key: "nav.tv" },
    ],
  },
  {
    key: "nav.group.house",
    rooms: [
      { href: "/dashboard/home", key: "nav.home" },
      { href: "/dashboard/cameras", key: "nav.cameras" },
      { href: "/dashboard/network", key: "nav.network" },
    ],
  },
  {
    key: "nav.group.record",
    rooms: [
      { href: "/dashboard/activity", key: "nav.activity" },
      { href: "/dashboard/privacy", key: "nav.privacy" },
      { href: "/dashboard/agents", key: "nav.agents" },
    ],
  },
  {
    key: "nav.group.box",
    rooms: [
      { href: "/dashboard/core", key: "nav.core" },
      { href: "/dashboard/settings", key: "nav.settings" },
    ],
  },
];

/**
 * The app shell: a quiet sidebar grouped by what things are, a status line
 * that always says where the box stands, and the page. Everything the
 * household owns is one click away, and nothing on screen is invented.
 */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
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

  const connected = connection.phase === "connected";
  const searching = connection.phase === "searching";

  const nav = (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={g.key ?? `g${gi}`}>
          {g.key && <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">{t(g.key)}</div>}
          <div className="flex flex-col gap-0.5">
            {g.rooms.map((room) => {
              const active = room.href === "/dashboard" ? path === room.href : path.startsWith(room.href);
              const Glyph = roomIcon[room.href];
              return (
                <Link
                  key={room.href}
                  href={room.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`tap flex items-center gap-2.5 rounded-[8px] px-3 py-[7px] text-[14px] ${
                    active ? "bg-ink font-medium text-bone" : "text-ink/80 hover:bg-ink/6 hover:text-ink"
                  }`}
                >
                  <Glyph size={18} className={active ? "opacity-90" : "opacity-55"} />
                  {t(room.key)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  /* The one line that says where the box stands. Never a guess: with nothing
     connected it says so, and the numbers beside it disappear rather than
     hold their last value. */
  const connectionChip =
    connection.phase === "off" ? null : connected ? (
      <Link href="/dashboard/core" data-testid="core-connection" className="tap rounded-full bg-local-bg px-2.5 py-1 font-medium text-local hover:brightness-95">
        {t("shell.core", { host: live.host ?? "" })}
      </Link>
    ) : searching ? (
      <span data-testid="core-connection" className="rounded-full bg-chassis px-2.5 py-1 font-medium text-ink/70">
        {t("shell.looking")}
      </span>
    ) : (
      <Link href="/dashboard/core#connect" data-testid="core-connection" className="tap rounded-full bg-ask-bg px-2.5 py-1 font-medium text-ask hover:brightness-95">
        {t("shell.noCore")}
      </Link>
    );

  const crossedToday = connected ? bytesCrossedToday(connection.rows) : 0;
  const gateChip = !connected ? null : gateOpen ? (
    <span className="tnum rounded-full bg-local-bg px-2.5 py-1 font-medium text-local" data-testid="gate-chip">
      {crossedToday === 0 ? t("shell.gateNothing") : t("shell.gateBytes", { bytes: formatBytes(crossedToday) })}
    </span>
  ) : (
    <span className="rounded-full bg-ask-bg px-2.5 py-1 font-medium text-ask">{t("shell.gateClosed")}</span>
  );

  const houseState = connected ? t("shell.ready") : searching ? t("shell.looking") : t("shell.noCore");

  return (
    <ToastProvider>
      <div data-theme={resolved} data-dash-theme={resolved} className="flex min-h-svh bg-bone text-ink">
        <ThemeStyle />

        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-[var(--rail)] shrink-0 flex-col border-r border-ink/8 px-4 py-5 lg:flex">
          <Link href="/" className="px-3" aria-label="Woven home">
            <Wordmark className="h-[18px]" />
          </Link>

          <div className="mt-6 px-3">
            <div className="truncate text-[13px] font-medium">{session.household}</div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
              <span className={connected ? "orb" : "block h-[6px] w-[6px] rounded-full bg-ash-2"} style={connected ? { ["--orb" as string]: "6px" } : undefined} />
              {houseState}
            </div>
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{nav}</div>

          <div className="mt-4 shrink-0 border-t border-ink/8 pt-4">
            <button
              type="button"
              onClick={() => setAccount(true)}
              className="tap -mx-1 flex w-[calc(100%+8px)] items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left hover:bg-ink/6"
              aria-haspopup="dialog"
            >
              <Avatar name={session.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{session.name}</span>
                <span className="block truncate text-[11px] capitalize text-ash">{session.role ?? "member"}</span>
              </span>
            </button>
            <div className="mt-3 px-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ash">
              <div className="truncate">{live.connected ? live.model : "No Core"}</div>
              <div>{live.version}</div>
              <div>
                Inside · <Clock />
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* A demonstration says so on every screen and cannot be dismissed. */}
          <DemoBanner />
          {connected && connection.status?.power?.power === "off" && (
            <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-[12px] text-bone" data-testid="power-banner" role="status">
              <span className="font-medium">The Core is switched off.</span>
              <span className="text-ash-2">Nothing runs, nothing leaves, nothing answers.</span>
              <Link href="/dashboard/core" className="font-medium underline underline-offset-2">
                Switch it on
              </Link>
            </div>
          )}

          <header className="sticky top-0 z-30 flex h-[var(--topbar)] items-center justify-between gap-3 border-b border-ink/8 bg-bone/80 px-4 backdrop-blur-md lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="tap rounded-[8px] px-2.5 py-1.5 text-[14px] font-medium hover:bg-ink/6"
                aria-haspopup="dialog"
                aria-expanded={open}
              >
                {t("shell.menu")}
              </button>
              <Wordmark className="h-[16px]" />
            </div>

            <div className="hidden min-w-0 items-center gap-2 text-[13px] text-ash lg:flex">
              {connectionChip}
              {connectionChip && gateChip && <span aria-hidden>·</span>}
              {gateChip}
              {connected && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tnum" data-testid="core-memory">
                    {memoryLabel(live)}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="tnum" data-testid="core-storage">
                    {storageLabel(live)}
                  </span>
                  {live.temperatureC !== null && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tnum">{temperatureLabel(live)}</span>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {connected && <SearchBox />}
              <Link href="/dashboard/ask" className="tap hidden rounded-[8px] bg-white px-3 py-1.5 text-[13px] text-ash ring-1 ring-ink/8 hover:text-ink md:block">
                {t("shell.ask")}
              </Link>
              <button
                type="button"
                onClick={() => setAccount(true)}
                aria-haspopup="dialog"
                aria-label={t("shell.account")}
                className="tap rounded-full ring-offset-2 ring-offset-bone hover:opacity-85 lg:hidden"
              >
                <Avatar name={session.name} size={32} />
              </button>
              <button type="button" onClick={leave} className="tap hidden text-[13px] font-medium text-ash hover:text-ink lg:block">
                {t("shell.signOut")}
              </button>
            </div>
          </header>

          {/* Mobile navigation drawer */}
          <Dialog open={open} onClose={() => setOpen(false)} variant="drawer" title={session.household} kicker={live.connected ? live.model : "No Core"}>
            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">
              <span className={connected ? "orb" : "block h-[6px] w-[6px] rounded-full bg-ash-2"} style={connected ? { ["--orb" as string]: "6px" } : undefined} />
              {!connected ? houseState : gateOpen ? t("shell.ready") : "Gate closed"}
            </div>
            <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
            <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
              <button type="button" onClick={leave} className="text-[14px] font-medium text-ash hover:text-ink">
                {t("shell.signOut")}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[14px] font-medium text-ash hover:text-ink">
                Close
              </button>
            </div>
          </Dialog>

          {/* Who is signed in, and the two things they might want to do about it. */}
          <Dialog open={account} onClose={() => setAccount(false)} title={session.name} kicker={t("shell.account")}>
            <dl className="mt-4 grid gap-2.5 text-[14px] sm:grid-cols-[110px_1fr]">
              <dt className="text-ash">{t("shell.household")}</dt>
              <dd className="truncate">{session.household}</dd>
              <dt className="text-ash">Role</dt>
              <dd className="capitalize">{session.role ?? "member"}</dd>
              {session.email && (
                <>
                  <dt className="text-ash">Email</dt>
                  <dd className="truncate">{session.email}</dd>
                </>
              )}
              <dt className="text-ash">Signed in with</dt>
              <dd className="capitalize">{session.method === "remote" ? "the relay, from away" : session.method}</dd>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-ash">
              The session lives on your Core, not here. Signing out ends it there too, on this device only.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard/settings" onClick={() => setAccount(false)} className="btn btn-secondary min-w-0! w-auto! px-4 text-[13px]!">
                Settings
              </Link>
              <button type="button" onClick={leave} className="btn btn-primary min-w-0! w-auto! px-4 text-[13px]!">
                {t("shell.signOut")}
              </button>
            </div>
          </Dialog>

          <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            {/* Every screen below is drawn from a Core. When none is answering there is
                nothing to draw, so the page says so rather than inventing a household. */}
            {/* Keyed on the route: the page settles when the room changes, and
                stays still while a card inside it updates. */}
            <div key={path} className="dash-page mx-auto w-full max-w-[var(--page-max)]">
              {connected || path.startsWith("/dashboard/core") ? children : <NoCore />}
            </div>
          </main>
        </div>

        {/* Walks between rooms, so it lives above the shell rather than in a page. */}
        <TourBar />
      </div>
    </ToastProvider>
  );
}
