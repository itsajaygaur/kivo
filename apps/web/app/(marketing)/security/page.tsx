const controls = [
  "Tenant IDs required at every repository boundary",
  "Private R2 objects with short-lived upload grants",
  "Collection authorization before retrieval and generation",
  "Fail-closed service authentication between Workers",
  "Hashed invitation tokens and verified-email admin gating",
  "CSP, strict cookies, CSRF and origin validation",
  "Immediate multi-store purging on deletion",
  "Document text treated as untrusted prompt data",
];
export default function Security() {
  return (
    <section className="section page-section">
      <div className="section-kicker">Security</div>
      <h2>Trust is part of the retrieval pipeline.</h2>
      <p className="section-lead">
        Kivo is designed for least privilege, explicit tenant boundaries, and privacy-preserving
        operations from upload through deletion. Each control is implemented as a centralized,
        testable platform control—not a UI convention.
      </p>
      <div className="spec-grid sequence">
        {controls.map((item, index) => (
          <article className="spec-cell" key={item}>
            <span className="spec-index">{String(index + 1).padStart(2, "0")}</span>
            <h3>{item}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
