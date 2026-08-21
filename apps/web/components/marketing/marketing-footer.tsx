import Link from "next/link";
import { Logo } from "@/components/logo";
export function MarketingFooter() {
  return (
    <footer className="footer">
      <div>
        <Logo />
        <p className="mono">© 2026 Kivo · Answers with receipts</p>
      </div>
      <div className="footer-links">
        <Link href="/#features">Product</Link>
        <Link href="/security">Security</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/sign-in">Sign in</Link>
        <Link href="/demo">Live demo</Link>
      </div>
    </footer>
  );
}
