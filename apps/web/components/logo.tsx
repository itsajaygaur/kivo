import Link from "next/link";
import type { Route } from "next";
export function Logo({ href = "/" }: { href?: Route }) {
  return (
    <Link href={href} className="brand">
      <span className="logo-mark">K</span>
      <span>Kivo</span>
    </Link>
  );
}
