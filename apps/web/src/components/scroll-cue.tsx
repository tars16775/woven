/** The small chevron Tesla puts at the bottom of a hero. Points at the next section. */
export function ScrollCue({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="Scroll to the next section"
      className="scroll-cue absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-[var(--section-muted)] md:block"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
