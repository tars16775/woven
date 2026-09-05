/** Marketing pages load under the floating nav, so the orb sits in the first slide's space. */
export default function MarketingLoading() {
  return (
    <div
      data-theme="light"
      role="status"
      aria-label="Loading"
      className="flex min-h-svh items-center justify-center bg-bone text-ink"
    >
      <span className="orb" style={{ ["--orb" as string]: "14px" }} />
    </div>
  );
}
