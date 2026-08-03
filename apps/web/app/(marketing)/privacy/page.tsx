import { Logo } from "@/components/logo";
export default function Privacy() {
  return (
    <main>
      <nav className="marketing-nav">
        <Logo />
      </nav>
      <article className="section" style={{ maxWidth: 760, paddingTop: 80 }}>
        <div className="section-kicker">Privacy</div>
        <h2>Plain-language privacy.</h2>
        <p className="section-lead">
          Kivo stores only what is needed to operate your workspace. Private documents are not used
          to train shared models. Workspace owners control retention, export, and deletion.
        </p>
        <div style={{ lineHeight: 1.8, color: "var(--muted)", marginTop: 40 }}>
          <h3 style={{ color: "var(--text)" }}>Data we process</h3>
          <p>
            Account identity, workspace configuration, uploaded documents, indexed chunks,
            conversations, citations, operational usage, and security audit events.
          </p>
          <h3 style={{ color: "var(--text)" }}>Control and deletion</h3>
          <p>
            Deleted knowledge enters a seven-day recoverable trash period, then is purged from D1,
            R2, and Vectorize. Audit events expire after 90 days by default.
          </p>
          <h3 style={{ color: "var(--text)" }}>Telemetry</h3>
          <p>
            Logs redact document bodies and secrets. Marketing analytics are aggregate and
            privacy-first.
          </p>
        </div>
      </article>
    </main>
  );
}
