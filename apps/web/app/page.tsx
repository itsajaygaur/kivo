import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
const features = [
  {
    title: "Every answer has receipts",
    body: "Hybrid semantic and keyword retrieval surfaces exact passages, page numbers, and durable citations.",
  },
  {
    title: "Permissions stay intact",
    body: "Workspace roles and collection access are enforced before evidence ever reaches a model.",
  },
  {
    title: "From file to answer, fast",
    body: "Resumable browser extraction and background indexing keep large uploads off the critical path.",
  },
  {
    title: "Grounded by design",
    body: "Kivo refuses unsupported claims, reports confidence, and treats document text as untrusted data.",
  },
  {
    title: "Your models, your choice",
    body: "Use Workers AI for free or bring encrypted OpenAI, Anthropic, and Google credentials.",
  },
  {
    title: "Built for living knowledge",
    body: "Versions, collections, retention, audit history, and feedback make knowledge accountable.",
  },
];
const evidence = [
  { name: "Product handbook", page: "p. 4", score: 94 },
  { name: "FY26 planning memo", page: "p. 11", score: 81 },
  { name: "Metrics definitions", page: "p. 2", score: 68 },
];
export default function Home() {
  return (
    <main>
      <MarketingNav />
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Private by default · Free to deploy
          </div>
          <h1>Your knowledge, finally answerable.</h1>
          <p className="hero-copy">
            Kivo turns scattered documents into fast, cited answers your team can trust—without
            loosening a single permission.
          </p>
          <div className="hero-actions">
            <Link href="/sign-in" className="button-primary">
              Build your knowledge base <ArrowRight size={15} />
            </Link>
            <a href="/demo" className="button-secondary">
              Try the live demo
            </a>
          </div>
          <p className="microcopy">
            <CheckCircle2 size={12} className="microcopy-check" />
            No credit card · Deploys entirely on Cloudflare&rsquo;s free tier
          </p>
        </div>
        <figure className="trace" aria-label="Kivo retrieval trace preview">
          <figcaption className="trace-rail">
            <span>Retrieval trace</span>
            <span>0417</span>
          </figcaption>
          <div className="trace-band">
            <span className="trace-label">Query</span>
            <p className="trace-query">What is our north-star metric, and why did we choose it?</p>
          </div>
          <div className="trace-band">
            <span className="trace-label">Evidence ranked</span>
            <div className="trace-evidence">
              {evidence.map(({ name, page, score }, index) => (
                <div className="evidence-row" key={name}>
                  <span className="cite">{index + 1}</span>
                  <span className="evidence-name">{name}</span>
                  <span className="evidence-page">{page}</span>
                  <span className="bar">
                    <span style={{ width: `${score}%` }} />
                  </span>
                  <span className="evidence-score">{score}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="trace-answer">
            Our north-star metric is <b>weekly verified answers</b>—answers opened by a teammate and
            positively confirmed against at least one cited source <span className="cite">1</span>.
            It rewards trusted outcomes instead of raw chat volume <span className="cite">2</span>.
          </div>
          <div className="trace-rail">
            <span>Sources 3</span>
            <span>Confidence high</span>
            <span>Permissions enforced</span>
          </div>
        </figure>
      </section>
      <section className="section" id="features">
        <div className="section-kicker">A knowledge layer, not another folder</div>
        <h2>Ask less where. Know more why.</h2>
        <p className="section-lead">
          One secure place to ingest, retrieve, and understand the decisions behind your work.
        </p>
        <div className="spec-grid">
          {features.map(({ title, body }, index) => (
            <article className="spec-cell" key={title}>
              <span className="spec-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section closing">
        <h2>Start with a single document.</h2>
        <p className="section-lead">
          Upload a document, ask a question, and follow the citation back to its page.
        </p>
        <div className="hero-actions">
          <Link href="/sign-in" className="button-primary">
            Create a workspace <ArrowRight size={15} />
          </Link>
          <a href="/demo" className="button-secondary">
            Browse the read-only demo
          </a>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
