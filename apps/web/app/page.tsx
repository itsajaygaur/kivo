import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  FileSearch,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
const features = [
  {
    icon: FileSearch,
    title: "Every answer has receipts",
    body: "Hybrid semantic and keyword retrieval surfaces exact passages, page numbers, and durable citations.",
  },
  {
    icon: ShieldCheck,
    title: "Permissions stay intact",
    body: "Workspace roles and collection access are enforced before evidence ever reaches a model.",
  },
  {
    icon: Zap,
    title: "From file to answer, fast",
    body: "Resumable browser extraction and background indexing keep large uploads off the critical path.",
  },
  {
    icon: Bot,
    title: "Grounded by design",
    body: "Kivo refuses unsupported claims, reports confidence, and treats document text as untrusted data.",
  },
  {
    icon: KeyRound,
    title: "Your models, your choice",
    body: "Use Workers AI for free or bring encrypted OpenAI, Anthropic, and Google credentials.",
  },
  {
    icon: BookOpen,
    title: "Built for living knowledge",
    body: "Versions, collections, retention, audit history, and feedback make knowledge accountable.",
  },
];
export default function Home() {
  return (
    <main className="noise">
      <nav className="marketing-nav">
        <Logo />
        <div className="nav-links">
          <Link href="/#features">Product</Link>
          <Link href="/security">Security</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/app" className="button-primary">
            Open workspace <ArrowRight size={14} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Private by default · free to deploy
          </div>
          <h1>
            Your knowledge,
            <br />
            <span>finally answerable.</span>
          </h1>
          <p className="hero-copy">
            Kivo turns scattered documents into fast, cited answers your team can trust—without
            loosening a single permission.
          </p>
          <div className="hero-actions">
            <Link href="/app" className="button-primary">
              Build your knowledge base <ArrowRight size={15} />
            </Link>
            <Link href="/docs" className="button-secondary">
              Explore the docs
            </Link>
          </div>
          <p className="microcopy">
            <CheckCircle2 size={12} style={{ display: "inline", marginRight: 5 }} />
            No credit card · Deploys entirely on Cloudflare’s free tier
          </p>
        </div>
        <div className="product-window glass" aria-label="Kivo cited answer preview">
          <div className="window-bar">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <div className="window-body">
            <div className="mini-sidebar">
              <Logo href="/app" />
              <div style={{ height: 20 }} />
              <div className="mini-nav active">
                <Sparkles size={11} />
                Ask Kivo
              </div>
              <div className="mini-nav">
                <BookOpen size={11} />
                Documents
              </div>
              <div className="mini-nav">
                <FileSearch size={11} />
                Search
              </div>
            </div>
            <div className="demo-chat">
              <div className="demo-question">
                What is our north-star metric, and why did we choose it?
              </div>
              <div className="demo-answer">
                <span className="ai-orb">K</span>
                <div>
                  <div className="answer-text">
                    Our north-star metric is <b>weekly verified answers</b>—answers opened by a
                    teammate and positively confirmed against at least one cited source. It rewards
                    trusted outcomes instead of raw chat volume.{" "}
                    <span style={{ color: "var(--accent)" }}>[1]</span>
                  </div>
                  <div className="citation-card">
                    <b style={{ color: "var(--text)" }}>Product handbook</b> · page 4<br />
                    “Weekly verified answers measure useful, trusted knowledge…”
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="logo-strip">
        Designed for teams who care where the answer came from
        <div className="logos">
          <span>Northstar</span>
          <span>Arcway</span>
          <span>Parallel</span>
          <span>Monument</span>
          <span>Daybreak</span>
        </div>
      </div>
      <section className="section" id="features">
        <div className="section-kicker">A knowledge layer, not another folder</div>
        <h2>
          Ask less where.
          <br />
          Know more why.
        </h2>
        <p className="section-lead">
          One secure place to ingest, retrieve, and understand the decisions behind your work.
        </p>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, body }) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={18} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="footer">
        <Logo />
        <span>© 2026 Kivo · Privacy · Status · GitHub</span>
      </footer>
    </main>
  );
}
