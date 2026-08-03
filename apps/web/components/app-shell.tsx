"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo href="/app" />
        <button className="workspace-switch">
          <span className="workspace-logo">AR</span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 12 }}>Acme Research</div>
            <div className="muted" style={{ fontSize: 10 }}>
              Free workspace
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
            <span className="avatar">AS</span>
            <div>
              <div style={{ fontWeight: 620, fontSize: 11 }}>Ajay Sharma</div>
              <div className="muted" style={{ fontSize: 10 }}>
                Owner
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button className="search-trigger">
            <Search size={14} />
            Search your knowledge…<span className="kbd">⌘ K</span>
          </button>
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
