import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
export function MarketingNav() {
  return (
    <nav className="marketing-nav">
      <Logo />
      <div className="nav-links">
        <Link href="/#features">Product</Link>
        <Link href="/security">Security</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-in" className="button-primary">
          Open workspace <ArrowRight size={14} />
        </Link>
      </div>
    </nav>
  );
}
