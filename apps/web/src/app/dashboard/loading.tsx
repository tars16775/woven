/** Dashboard pages render inside the shell; the orb fills the content area while a page streams. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[60svh] items-center justify-center">
      <span className="orb" style={{ ["--orb" as string]: "12px" }} />
    </div>
  );
}
