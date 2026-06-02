type MarkProps = { className?: string };

/**
 * Tennis-ball brand mark — flat fill with the signature seam curve.
 * Used as the consistent decorative motif across sections (replaces the
 * generic floating emoji ornaments).
 */
export function BallMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden role="presentation">
      <circle cx="24" cy="24" r="21" fill="var(--sun)" stroke="var(--forest)" strokeWidth="2.5" />
      <path
        d="M9 14 C 18 22, 18 30, 9 38"
        fill="none"
        stroke="var(--forest)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M39 10 C 30 18, 30 28, 39 36"
        fill="none"
        stroke="var(--forest)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Single seam curve — a quiet brand stroke for corners and dividers.
 */
export function SeamLine({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 120 24" className={className} aria-hidden role="presentation">
      <path
        d="M4 12 C 30 2, 50 22, 76 12 C 96 4, 108 18, 116 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
