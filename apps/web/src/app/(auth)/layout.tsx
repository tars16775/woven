import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { CoreNotice } from "./notice";

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
            <CoreNotice />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
