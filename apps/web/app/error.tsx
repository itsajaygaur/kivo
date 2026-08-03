"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}
    >
      <div>
        <div className="logo-mark" style={{ margin: "auto" }}>
          K
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
