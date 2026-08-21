"use client";
import { KivoMark } from "@/components/logo";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="system-page">
      <div className="system-card">
        <div className="logo-mark">
          <KivoMark />
        </div>
        <h1>Something interrupted Kivo.</h1>
        <p className="muted">No document content or secrets were included in the error report.</p>
        <button className="button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
