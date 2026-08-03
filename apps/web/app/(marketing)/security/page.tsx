import { Logo } from "@/components/logo";
import Link from "next/link";
const controls = [
  "Tenant IDs required at every repository boundary",
  "Private R2 objects with short-lived upload grants",
  "Collection authorization before retrieval and generation",
  "AES-GCM encryption for workspace-owned model keys",
  "Hashed API keys and invitation tokens",
  "CSP, strict cookies, CSRF and origin validation",
  "Auditable lifecycle jobs and complete scheduled purging",
  "Document text treated as untrusted prompt data",
];
export default function Security() {
  return (
    <main>
      <nav className="marketing-nav">
        <Logo />
        <Link href="/app" className="button-primary">
          Open Kivo
        </Link>
      </nav>
      <section className="section" style={{ paddingTop: 100 }}>
        <div className="section-kicker">Security</div>
        <h2>
          Trust is part of
          <br />
          the retrieval pipeline.
        </h2>
        <p className="section-lead">
          Kivo is designed for least privilege, explicit tenant boundaries, and privacy-preserving
          operations from upload through deletion.
        </p>
        <div className="feature-grid">
          {controls.map((item, i) => (
            <article className="feature-card" key={item}>
              <div className="feature-icon">0{i + 1}</div>
              <h3 style={{ marginTop: 38 }}>{item}</h3>
              <p>Implemented as a centralized, testable platform control—not a UI convention.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
