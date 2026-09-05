import Link from "next/link";
import { CoreDevice } from "@/components/core-device";
import { Nav } from "@/components/nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main
        data-theme="light"
        className="flex min-h-svh flex-col items-center justify-center bg-bone px-6 py-24 text-center text-ink"
      >
        <CoreDevice
          label="WOVEN"
          state="Not here."
          status="that page is not on this box"
          size="min(420px, 34vh, 60vw)"
        />
        <h1 className="mt-10 font-display text-[32px] font-medium tracking-[-0.02em]">
          Nothing at this address.
        </h1>
        <p className="mt-2 max-w-[420px] text-[15px] text-ash">
          The link may be old, or the page may not exist yet. The box, at least, is fine.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
          <Link href="/support" className="btn btn-secondary">
            Support
          </Link>
        </div>
      </main>
    </>
  );
}
