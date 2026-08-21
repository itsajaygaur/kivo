import Link from "next/link";
import { KivoMark } from "@/components/logo";
export default function NotFound() {
  return (
    <main className="system-page">
      <div className="system-card">
        <div className="logo-mark">
          <KivoMark />
        </div>
        <h1>Knowledge not found.</h1>
        <p className="muted">This page moved, was deleted, or you do not have access.</p>
        <Link href="/app" className="button-primary">
          Back to Kivo
        </Link>
      </div>
    </main>
  );
}
