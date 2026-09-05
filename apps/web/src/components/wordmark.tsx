/** The lowercase "woven" wordmark with the amber underline from the chassis fascia. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center font-display text-[22px] font-semibold leading-none tracking-[-0.02em] ${className}`}
      aria-hidden="true"
    >
      woven
      <span className="mt-[3px] block h-[2px] w-[22px] rounded-full bg-amber" />
    </span>
  );
}
