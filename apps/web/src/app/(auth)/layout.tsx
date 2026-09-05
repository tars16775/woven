import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="grid min-h-svh bg-bone text-ink lg:grid-cols-[1fr_1fr]">
      {/* Left: the box, quietly */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-graphite p-10 text-bone lg:flex">
        <Link href="/" aria-label="Woven home">
          <Wordmark className="h-[20px] text-bone" />
        </Link>
        <div className="flex flex-col items-center">
          <span className="orb" style={{ ["--orb" as string]: "18px" }} />
          <div className="mt-14 font-display text-[36px] font-medium tracking-[-0.02em]">Ready.</div>
          <div className="mt-2 text-[14px] text-ash-2">Your house is inside. Sign in to reach it.</div>
        </div>
        <p className="max-w-[380px] text-[12px] leading-relaxed text-ash-2">
          Signing in never sends your files, photos or memory anywhere. Your key crosses the Gate;
          your data does not.
        </p>
      </aside>
      <main id="main" className="flex flex-col px-6 py-8 lg:px-16">
        <div className="flex items-center justify-between lg:hidden">
          <Link href="/" aria-label="Woven home">
            <Wordmark className="h-[18px]" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <PreviewNotice />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * There is no Core to talk to yet. Say so, plainly, above every sign-in
 * form so nobody mistakes the preview for the real thing.
 */
function PreviewNotice() {
  return (
    <div
      role="note"
      aria-label="Preview notice"
      className="mb-7 flex gap-3 rounded-[10px] bg-ask-bg px-4 py-3 ring-1 ring-ask/20"
    >
      <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 rounded-full bg-ask" aria-hidden />
      <p className="text-[13px] leading-relaxed text-ink">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ask">Preview</span>
        <br />
        Founding Homes preview. Sign-in is simulated on this device until your Core arrives; nothing
        is sent anywhere.
      </p>
    </div>
  );
}
