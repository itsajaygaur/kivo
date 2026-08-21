import Link from "next/link";
import type { Route } from "next";

/* The mark is a corpus grid with one located cell: the square is the body of
 * knowledge, the filled cell is the passage retrieval found. It inherits
 * currentColor so it inverts with the theme, and the cell is the one place the
 * signal colour appears in the brand. */
export function KivoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <rect x="15" y="9" width="6" height="6" fill="var(--signal)" />
      <path
        d="M9 3v18M15 3v18M3 9h18M3 15h18"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".28"
      />
      <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: Route }) {
  return (
    <Link href={href} className="brand">
      <span className="logo-mark">
        <KivoMark />
      </span>
      <span>Kivo</span>
    </Link>
  );
}
