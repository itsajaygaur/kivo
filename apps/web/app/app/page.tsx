"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  HardDrive,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, formatBytes, formatRelativeTime } from "@/lib/api-client";

type Usage = {
  documents: number;
  documentLimit: number;
  storageBytes: number;
  storageLimit: number;
  members: number;
  memberLimit: number;
};
type DocumentRow = {
  id: string;
  title: string;
  filename: string;
  status: string;
  collectionName: string | null;
  updatedAt: number;
};
type AuditRow = { id: string; action: string; targetType: string; createdAt: number };
type Workspace = { name: string; userName: string };

export default function Overview() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [activity, setActivity] = useState<AuditRow[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ data: Usage }>("/usage"),
      api<{ data: DocumentRow[] }>("/documents"),
      api<{ data: AuditRow[] }>("/audit"),
      api<{ data: Workspace }>("/workspace"),
    ])
      .then(([usageResponse, documentResponse, auditResponse, workspaceResponse]) => {
        setUsage(usageResponse.data);
        setDocuments(documentResponse.data);
        setActivity(auditResponse.data);
        setWorkspace(workspaceResponse.data);
      })
      .catch(() => undefined);
  }, []);

  const ready = documents.filter(({ status }) => status === "ready").length;
  const metrics: { label: string; value: string; trend: string; Icon: LucideIcon }[] = [
    {
      label: "Documents",
      value: usage ? String(usage.documents) : "—",
      trend: usage ? `${usage.documentLimit - usage.documents} slots available` : "Loading",
      Icon: FileText,
    },
    {
      label: "Indexed",
      value: usage ? String(ready) : "—",
      trend: documents.some(({ status }) => status !== "ready")
        ? "Indexing in progress"
        : "Knowledge is current",
      Icon: CheckCircle2,
    },
    {
      label: "Storage",
      value: usage ? formatBytes(usage.storageBytes) : "—",
      trend: usage ? `${formatBytes(usage.storageLimit)} limit` : "Loading",
      Icon: HardDrive,
    },
    {
      label: "Members",
      value: usage ? `${usage.members} of ${usage.memberLimit}` : "—",
      trend: "Workspace access",
      Icon: Users,
    },
  ];

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Welcome, {workspace?.userName?.split(" ")[0] ?? "there"}</h1>
          <p>
            {workspace ? `Here’s what’s indexed in ${workspace.name}.` : "Loading your workspace…"}
          </p>
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
              View all <ArrowUpRight size={11} />
            </Link>
          </header>
          <div className="table-scroll">
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
                {documents.slice(0, 5).map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className="doc-cell">
                        <span className="file-icon">
                          <FileText size={14} />
                        </span>
                        <div>
                          {document.title}
                          <div className="muted" style={{ fontSize: 10, fontWeight: 400 }}>
                            {document.filename}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{document.collectionName ?? "Unsorted"}</td>
                    <td>
                      <span className="status">
                        {document.status === "ready" && <CheckCircle2 size={10} />}
                        {document.status}
                      </span>
                    </td>
                    <td className="muted">{formatRelativeTime(document.updatedAt)}</td>
                  </tr>
                ))}
                {!documents.length && (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      Upload a document to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <header className="panel-head">
            <h2>Workspace activity</h2>
            <Activity size={15} className="muted" />
          </header>
          <div className="activity">
            {activity.slice(0, 6).map((event) => (
              <div className="activity-item" key={event.id}>
                <span className="activity-dot" />
                <div>
                  {event.action.replaceAll(".", " ")}
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                    {formatRelativeTime(event.createdAt)} · {event.targetType}
                  </div>
                </div>
              </div>
            ))}
            {!activity.length && (
              <p className="muted" style={{ fontSize: 11, padding: 14 }}>
                Activity will appear as your team changes the knowledge base.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
