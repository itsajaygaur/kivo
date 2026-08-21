import Link from "next/link";
const steps = [
  {
    title: "Add knowledge",
    body: "Drag files into Documents. Extraction is resumable and originals remain private.",
  },
  {
    title: "Shape access",
    body: "Use roles and restricted collections to give every teammate the right evidence.",
  },
  {
    title: "Ask naturally",
    body: "Search or chat in any language. Scope a question to collections or documents.",
  },
  {
    title: "Verify quickly",
    body: "Open a citation at its page and highlighted source passage before acting.",
  },
];
export default function Docs() {
  return (
    <section className="section page-section">
      <div className="section-kicker">Documentation</div>
      <h2>From upload to a grounded answer.</h2>
      <p className="section-lead">
        Create a workspace, add a collection, and upload PDF, DOCX, Markdown, text, HTML, CSV, or
        JSON. Kivo extracts in your browser, indexes in the background, and makes every answer
        traceable.
      </p>
      <div className="index-list">
        {steps.map(({ title, body }, index) => (
          <article className="index-row" key={title}>
            <span className="index-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <p className="section-cta">
        <Link href="/api/v1/openapi.json" className="button-secondary">
          View OpenAPI specification
        </Link>
      </p>
    </section>
  );
}
