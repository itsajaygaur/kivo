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
            operational usage, and security audit events. Chat conversations are answered in the
            moment and are not stored.
          </p>
          <h3 style={{ color: "var(--text)" }}>Control and deletion</h3>
          <p>
            Deleting a document immediately removes its stored original, its indexed text, and its
            vectors from D1, R2, and Vectorize. Deletion is permanent — there is no recovery window.
            Audit events are retained for the life of the workspace.
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
