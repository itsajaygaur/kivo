"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, AlertCircle, CheckCircle2, Folder, Plus, Shield, Users } from "lucide-react";
import { api, formatBytes, formatRelativeTime } from "@/lib/api-client";

const content = {
  collections: {
    title: "Collections",
    description: "Organize knowledge and control retrieval scope.",
  },
  members: { title: "Members", description: "People with access to this workspace." },
  analytics: { title: "Analytics", description: "Live ingestion and capacity signals." },
  audit: { title: "Audit log", description: "Recorded workspace changes." },
  settings: {
    title: "Workspace settings",
    description: "Current workspace and access configuration.",
  },
  admin: { title: "Platform administration", description: "Runtime dependency health." },
} as const;

type Kind = keyof typeof content;
type Collection = {
  id: string;
  name: string;
  description: string | null;
  restricted: number;
  documentCount: number;
};
type Member = { id: string; name: string; email: string; role: string; joinedAt: number };
type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: number;
};
type Usage = {
  documents: number;
  documentLimit: number;
  storageBytes: number;
  storageLimit: number;
  members: number;
  memberLimit: number;
};
type Workspace = { name: string; slug: string; role: string; userName: string; userEmail: string };

export function SectionPage({ kind }: { kind: Kind }) {
  const item = content[kind];
  const [collections, setCollections] = useState<Collection[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (kind === "collections")
        setCollections((await api<{ data: Collection[] }>("/collections")).data);
      if (kind === "members") setMembers((await api<{ data: Member[] }>("/members")).data);
      if (kind === "audit") setEvents((await api<{ data: AuditEvent[] }>("/audit")).data);
      if (kind === "analytics") setUsage((await api<{ data: Usage }>("/usage")).data);
      if (kind === "settings") setWorkspace((await api<{ data: Workspace }>("/workspace")).data);
      if (kind === "admin") {
        const response = await fetch("/api/v1/health");
        setHealth((await response.json()) as Record<string, unknown>);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCollection(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return;
    setCreating(true);
    try {
      await api("/collections", { method: "POST", body: JSON.stringify({ name, restricted }) });
      setName("");
      setRestricted(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the collection.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {kind === "collections" && (
        <>
          <form className="inline-form panel" onSubmit={(event) => void createCollection(event)}>
            <input
              aria-label="Collection name"
              placeholder="New collection name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={restricted}
                onChange={(event) => setRestricted(event.target.checked)}
              />{" "}
              Restricted
            </label>
            <button className="button-primary" disabled={creating || name.trim().length < 2}>
              <Plus size={14} />
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
          <div className="feature-grid" style={{ marginTop: 14 }}>
            {collections.map((collection) => (
              <article className="feature-card" key={collection.id}>
                <span className="feature-icon">
                  <Folder size={17} />
                </span>
                <h3>{collection.name}</h3>
                <p>{collection.description || "No description yet."}</p>
                <div className="muted" style={{ fontSize: 10, marginTop: 20 }}>
                  <Users size={11} /> {collection.documentCount} documents ·{" "}
                  {collection.restricted ? "Restricted" : "Workspace-wide"}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {kind === "members" && (
        <section className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <b>{member.name}</b>
                    <div className="muted">{member.email}</div>
                  </td>
                  <td>
                    <span className="status">{member.role}</span>
                  </td>
                  <td className="muted">{formatRelativeTime(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {kind === "audit" && (
        <section className="panel">
          <header className="panel-head">
            <h2>Recent events</h2>
            <Shield size={14} className="muted" />
          </header>
          {events.map((event) => (
            <div className="event-row" key={event.id}>
              <span className="feature-icon">
                <Activity size={13} />
              </span>
              <div>
                <b>{event.action.replaceAll(".", " ")}</b>
                <div className="muted">
                  {event.targetType} · {formatRelativeTime(event.createdAt)}
                </div>
              </div>
            </div>
          ))}
          {!events.length && <div className="empty-cell">No recorded events yet.</div>}
        </section>
      )}

      {kind === "analytics" && (
        <div className="metric-grid">
          {[
            ["Documents", usage ? `${usage.documents} / ${usage.documentLimit}` : "—"],
            [
              "Storage",
              usage
                ? `${formatBytes(usage.storageBytes)} / ${formatBytes(usage.storageLimit)}`
                : "—",
            ],
            ["Members", usage ? `${usage.members} / ${usage.memberLimit}` : "—"],
          ].map(([label, value]) => (
            <article className="metric" key={label}>
              <div className="metric-top">{label}</div>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </div>
      )}

      {kind === "settings" && (
        <section className="panel definition-list">
          <div>
            <span>Workspace</span>
            <b>{workspace?.name ?? "Loading…"}</b>
          </div>
          <div>
            <span>Slug</span>
            <b>{workspace?.slug ?? "—"}</b>
          </div>
          <div>
            <span>Signed in as</span>
            <b>{workspace?.userEmail ?? "—"}</b>
          </div>
          <div>
            <span>Role</span>
            <b>{workspace?.role ?? "—"}</b>
          </div>
        </section>
      )}

      {kind === "admin" && (
        <section className="panel definition-list">
          {Object.entries(health ?? {}).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{String(value)}</b>
            </div>
          ))}
          {!health && (
            <div>
              <span>Runtime</span>
              <b>Checking…</b>
            </div>
          )}
          {health?.status === "ok" && (
            <div className="notice">
              <CheckCircle2 size={14} />
              All required runtime services are bound.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
