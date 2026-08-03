import {
  ArrowUpRight,
  CheckCircle2,
  Folder,
  MoreHorizontal,
  Plus,
  Shield,
  Users,
} from "lucide-react";
const content = {
  collections: {
    title: "Collections",
    description: "Organize knowledge and control who can retrieve it.",
  },
  members: { title: "Members", description: "Manage roles, invitations, and collection access." },
  analytics: {
    title: "Analytics",
    description: "Understand questions, quality, and knowledge gaps.",
  },
  audit: {
    title: "Audit log",
    description: "A tamper-evident record of important workspace activity.",
  },
  settings: {
    title: "Workspace settings",
    description: "Configure AI, API access, security, and retention.",
  },
  admin: {
    title: "Platform administration",
    description: "System health, quotas, failed jobs, users, and workspaces.",
  },
} as const;
export function SectionPage({ kind }: { kind: keyof typeof content }) {
  const item = content[kind];
  if (kind === "collections")
    return (
      <div className="content">
        <div className="page-head">
          <div>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>
          <button className="button-primary">
            <Plus size={14} />
            New collection
          </button>
        </div>
        <div className="feature-grid" style={{ marginTop: 0 }}>
          {[
            ["Product & Engineering", "72 documents", "Open"],
            ["Security", "28 documents", "Restricted"],
            ["Customer research", "36 documents", "Open"],
            ["Company", "31 documents", "Open"],
            ["Operations", "17 documents", "Restricted"],
          ].map(([name, count, access], i) => (
            <article className="feature-card" key={name}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="feature-icon">
                  <Folder size={17} />
                </span>
                <MoreHorizontal size={15} />
              </div>
              <h3>{name}</h3>
              <p>
                {count} · {access}
              </p>
              <div className="muted" style={{ fontSize: 10, marginTop: 20 }}>
                <Users size={11} style={{ display: "inline", marginRight: 5 }} />
                {access === "Open" ? "Everyone in workspace" : "8 authorized members"}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  if (kind === "analytics")
    return (
      <div className="content">
        <div className="page-head">
          <div>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>
          <button className="button-secondary">Last 30 days</button>
        </div>
        <div className="metric-grid">
          {[
            ["Answer rate", "91.4%", "+4.2%"],
            ["Recall@10", "89.2%", "Target ≥ 85%"],
            ["Median latency", "2.1s", "−340ms"],
            ["Positive feedback", "87.6%", "+2.8%"],
          ].map(([a, b, c]) => (
            <article className="metric" key={a}>
              <div className="metric-top">{a}</div>
              <div className="metric-value">{b}</div>
              <div className="trend">{c}</div>
            </article>
          ))}
        </div>
        <section className="panel" style={{ marginTop: 14, padding: 20 }}>
          <h2 style={{ fontSize: 13 }}>Questions over time</h2>
          <div style={{ height: 230, display: "flex", alignItems: "end", gap: 9, paddingTop: 30 }}>
            {[32, 44, 39, 58, 64, 53, 72, 68, 81, 76, 91, 84, 96, 88].map((h, i) => (
              <div
                key={i}
                style={{
                  height: `${h}%`,
                  flex: 1,
                  borderRadius: "5px 5px 2px 2px",
                  background: `color-mix(in srgb,var(--accent) ${35 + i * 3}%,var(--surface-2))`,
                }}
              />
            ))}
          </div>
        </section>
      </div>
    );
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
        <button className="button-primary">
          {kind === "members" ? (
            <>
              <Plus size={14} />
              Invite member
            </>
          ) : (
            "Export"
          )}
        </button>
      </div>
      <section className="panel">
        <header className="panel-head">
          <h2>
            {kind === "members"
              ? "18 workspace members"
              : kind === "audit"
                ? "Recent events"
                : kind === "admin"
                  ? "System health"
                  : "Configuration"}
          </h2>
          <span className="status">
            <CheckCircle2 size={10} />
            Healthy
          </span>
        </header>
        {[
          "Workspace owner reviewed security settings",
          "Product handbook was re-indexed",
          "API key used from a new region",
          "Retention policy completed successfully",
          "Invitation accepted by noah@acme.test",
        ].map((x, i) => (
          <div
            key={x}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              borderTop: i ? "1px solid var(--line)" : "0",
            }}
          >
            <span className="feature-icon" style={{ width: 30, height: 30 }}>
              <Shield size={13} />
            </span>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 570 }}>
              {x}
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>
                {i + 1} day{i ? "s" : ""} ago · 103.21.x.x
              </div>
            </div>
            <ArrowUpRight size={13} className="muted" />
          </div>
        ))}
      </section>
    </div>
  );
}
