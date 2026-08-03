import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareText,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
const docs = [
  ["Product handbook", "Markdown", "Updated 12m ago"],
  ["Security architecture", "PDF · 28 pages", "Updated yesterday"],
  ["Customer research synthesis", "DOCX · 3.8 MB", "Updated 2d ago"],
  ["Incident response runbook", "Markdown", "Updated 4d ago"],
];
const metrics: { label: string; value: string; trend: string; Icon: LucideIcon }[] = [
  { label: "Documents", value: "184", trend: "+12 this month", Icon: FileText },
  { label: "Verified answers", value: "1,284", trend: "+18.4%", Icon: CheckCircle2 },
  { label: "Questions asked", value: "2,906", trend: "+23.1%", Icon: MessageSquareText },
  { label: "Members", value: "18 of 25", trend: "3 active now", Icon: Users },
];
export default function Overview() {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Good morning, Ajay</h1>
          <p>Here’s what’s happening across Acme Research.</p>
        </div>
        <Link href="/app/chat" className="button-primary">
          <Sparkles size={15} />
          Ask Kivo
        </Link>
      </div>
      <section className="metric-grid">
        {metrics.map(({ label, value, trend, Icon }) => (
          <article className="metric" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon size={15} />
            </div>
            <div className="metric-value">{value}</div>
            <div className="trend">{trend}</div>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel-head">
            <h2>Recently updated</h2>
            <Link href="/app/documents" className="muted" style={{ fontSize: 11 }}>
              View all <ArrowUpRight size={11} style={{ display: "inline" }} />
            </Link>
          </header>
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Collection</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(([name, type, time]) => (
                <tr key={name}>
                  <td>
                    <div className="doc-cell">
                      <span className="file-icon">
                        <FileText size={14} />
                      </span>
                      <div>
                        {name}
                        <div className="muted" style={{ fontSize: 10, fontWeight: 400 }}>
                          {type}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>Product & Engineering</td>
                  <td>
                    <span className="status">
                      <CheckCircle2 size={10} />
                      Ready
                    </span>
                  </td>
                  <td className="muted">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Workspace activity</h2>
            <Activity size={15} className="muted" />
          </header>
          <div className="activity">
            {[
              ["Maya uploaded Security architecture", "12 minutes ago"],
              ["Kivo answered 34 questions", "Today"],
              ["Noah joined as an Editor", "Yesterday"],
              ["Product handbook was re-indexed", "2 days ago"],
            ].map(([text, time]) => (
              <div className="activity-item" key={text}>
                <span className="activity-dot" />
                <div>
                  {text}
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                    <Clock3 size={9} style={{ display: "inline", marginRight: 4 }} />
                    {time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section
        className="panel"
        style={{ marginTop: 14, padding: 20, display: "flex", alignItems: "center", gap: 14 }}
      >
        <div className="feature-icon">
          <Bot size={17} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>Kivo found 6 questions without enough evidence</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Review gaps to decide what your knowledge base needs next.
          </div>
        </div>
        <button className="button-secondary">Review gaps</button>
      </section>
    </div>
  );
}
