import { Logo } from "@/components/logo";
import Link from "next/link";
export default function Docs() {
  return (
    <main>
      <nav className="marketing-nav">
        <Logo />
        <Link href="/app" className="button-primary">
          Open Kivo
        </Link>
      </nav>
      <section className="section" style={{ maxWidth: 900, paddingTop: 90 }}>
        <div className="section-kicker">Documentation</div>
        <h2>From upload to a grounded answer.</h2>
        <p className="section-lead">
          Create a workspace, add a collection, and upload PDF, DOCX, Markdown, text, HTML, CSV, or
          JSON. Kivo extracts in your browser, indexes in the background, and makes every answer
          traceable.
        </p>
        <div className="feature-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {[
            [
              "1. Add knowledge",
              "Drag files into Documents. Extraction is resumable and originals remain private.",
            ],
            [
              "2. Shape access",
              "Use roles and restricted collections to give every teammate the right evidence.",
            ],
            [
              "3. Ask naturally",
              "Search or chat in any language. Scope a question to collections or documents.",
            ],
            [
              "4. Verify quickly",
              "Open a citation at its page and highlighted source passage before acting.",
            ],
          ].map(([a, b]) => (
            <article className="feature-card" key={a}>
              <h3 style={{ marginTop: 0 }}>{a}</h3>
              <p>{b}</p>
            </article>
          ))}
        </div>
        <p style={{ marginTop: 36 }}>
          <Link href="/api/v1/openapi.json" className="button-secondary">
            View OpenAPI specification
          </Link>
        </p>
      </section>
    </main>
  );
}
