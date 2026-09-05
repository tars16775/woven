/** Root loading state: the box's breathing light, nothing else. */
export default function Loading() {
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
