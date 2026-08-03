"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import { Logo } from "./logo";
import { api, ApiError } from "@/lib/api-client";
const primary = [
  [/app$/, "/app", LayoutDashboard, "Overview"],
  [/documents/, "/app/documents", FileText, "Documents"],
  [/collections/, "/app/collections", Boxes, "Collections"],
  [/chat/, "/app/chat", Bot, "Ask Kivo"],
  [/search/, "/app/search", Search, "Search"],
] as const;
const manage = [
  ["/app/analytics", BarChart3, "Analytics"],
  ["/app/members", Users, "Members"],
  ["/app/audit", History, "Audit log"],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<{
    name: string;
    userName: string;
    role: string;
  } | null>(null);
  useEffect(() => {
    void api<{ data: { name: string; userName: string; role: string } }>("/workspace")
      .then(({ data }) => setWorkspace(data))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) router.replace("/sign-in");
      });
  }, [router]);
  const initials = (workspace?.userName ?? "Kivo User")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo href="/app" />
        <button className="workspace-switch">
          <span className="workspace-logo">AR</span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 12 }}>{workspace?.name ?? "Workspace"}</div>
            <div className="muted" style={{ fontSize: 10 }}>
              {workspace ? `${workspace.role} access` : "Loading…"}
            </div>
          </div>
          <ChevronsUpDown size={13} style={{ marginLeft: "auto" }} />
        </button>
        <div className="side-label">Workspace</div>
        {primary.map(([match, href, Icon, label]) => (
          <Link
            aria-label={label}
            href={href}
            key={href}
            className={`side-link ${match.test(path) ? "active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
        <div className="side-label">Manage</div>
        {manage.map(([href, Icon, label]) => (
          <Link
            aria-label={label}
            href={href}
            key={href}
            className={`side-link ${path === href ? "active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
        <div className="sidebar-bottom">
          <Link href="/app/admin" className="side-link">
            <Shield />
            <span>Platform admin</span>
          </Link>
          <Link href="/app/settings" className="side-link">
            <Settings />
            <span>Settings</span>
          </Link>
          <Link href="/docs" className="side-link">
            <CircleHelp />
            <span>Help & docs</span>
          </Link>
          <div className="user-pill">
            <span className="avatar">{initials}</span>
            <div>
              <div style={{ fontWeight: 620, fontSize: 11 }}>
                {workspace?.userName ?? "Kivo User"}
              </div>
              <div className="muted" style={{ fontSize: 10 }}>
                {workspace?.role ?? "Member"}
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <Link href="/app/search" className="search-trigger">
            <Search size={14} />
            Search your knowledge…<span className="kbd">⌘ K</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="status">
              <span className="eyebrow-dot" />
              All systems normal
            </span>
            <Link
              href="/app/documents"
              className="button-primary"
              style={{ padding: "8px 12px", fontSize: 12 }}
            >
              <Upload size={14} />
              Upload
            </Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
