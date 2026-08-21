"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Boxes,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  History,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Upload,
  Users,
  LogOut,
} from "lucide-react";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";
import { api, ApiError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
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
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    userName: string;
    role: string;
    demo: boolean;
    platformAdmin: boolean;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string; role: string; active: number | boolean; demo?: boolean }>
  >([]);
  useEffect(() => {
    void Promise.all([
      api<{
        data: {
          id: string;
          name: string;
          userName: string;
          role: string;
          demo: boolean;
          platformAdmin: boolean;
        };
      }>("/workspace"),
      api<{ data: Array<{ id: string; name: string; role: string; active: number | boolean }> }>(
        "/workspaces",
      ),
    ])
      .then(([current, available]) => {
        setWorkspace(current.data);
        setWorkspaces(available.data);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) router.replace("/sign-in");
      });
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function switchWorkspace(organizationId: string) {
    if (!organizationId || organizationId === workspace?.id) return;
    await api(`/workspaces/${organizationId}/activate`, { method: "POST" });
    window.location.assign("/app");
  }

  async function signOut() {
    await api("/demo-session", { method: "DELETE" }).catch(() => undefined);
    await authClient.signOut().catch(() => undefined);
    window.location.assign("/sign-in");
  }
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo href="/app" />
        <div className="workspace-switch">
          <span className="workspace-logo">{initialsOf(workspace?.name ?? "Kivo")}</span>
          <div className="workspace-meta">
            <strong>{workspace?.name ?? "Workspace"}</strong>
            <small>{workspace ? `${workspace.role} access` : "Loading…"}</small>
          </div>
          {workspaces.length > 1 ? (
            <select
              aria-label="Switch workspace"
              value={workspace?.id ?? ""}
              onChange={(event) => void switchWorkspace(event.target.value)}
            >
              {workspaces.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : (
            <ChevronsUpDown size={13} className="workspace-caret" />
          )}
        </div>
        <div className="side-label">Workspace</div>
        {primary.map(([match, href, Icon, label]) => (
          <Link
            aria-label={label}
            href={href}
            key={href}
            className={`side-link side-link-mobile ${match.test(path) ? "active" : ""}`}
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
          {workspace?.platformAdmin && (
            <Link href="/app/admin" className="side-link">
              <Shield />
              <span>Platform admin</span>
            </Link>
          )}
          <Link href="/app/settings" className="side-link">
            <Settings />
            <span>Settings</span>
          </Link>
          <Link href="/docs" className="side-link">
            <CircleHelp />
            <span>Help & docs</span>
          </Link>
          <div className="user-pill">
            <span className="avatar">{initialsOf(workspace?.userName ?? "Kivo User")}</span>
            <div className="user-meta">
              <strong>{workspace?.userName ?? "Kivo User"}</strong>
              <small>{workspace?.role ?? "Member"}</small>
            </div>
            <button aria-label="Sign out" className="icon-button" onClick={() => void signOut()}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="search-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command menu"
          >
            <Search size={14} />
            Search your knowledge…<span className="kbd">⌘ K</span>
          </button>
          <div className="topbar-actions">
            <Link href="/app/documents" className="button-primary compact">
              <Upload size={14} />
              Upload
            </Link>
          </div>
        </header>
        {children}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          platformAdmin={workspace?.platformAdmin ?? false}
        />
      </main>
    </div>
  );
}
