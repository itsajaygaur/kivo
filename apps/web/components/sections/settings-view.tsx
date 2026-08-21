"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, KeyRound, Plus, Save } from "lucide-react";
import { api, formatBytes } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { canManageWorkspace, SectionShell, type Workspace } from "./shared";

export function SettingsView() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await api<{ data: Workspace }>("/workspace");
      setWorkspace(current.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!workspace) return;
    setPending("workspace-save");
    try {
      await api("/workspace", {
        method: "PATCH",
        body: JSON.stringify({
          name: workspace.name,
          slug: workspace.slug,
          retentionDays: workspace.retentionDays,
        }),
      });
      setNotice("Workspace settings saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save workspace settings.");
    } finally {
      setPending(null);
    }
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    setPending("workspace-create");
    try {
      await api("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the workspace.");
      setPending(null);
    }
  }

  async function addPasskey() {
    setPending("passkey");
    try {
      const result = await authClient.passkey.addPasskey({ name: "Kivo passkey" });
      if (result.error) setError(result.error.message ?? "Could not register the passkey.");
      else setNotice("Passkey registered.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not register the passkey.");
    } finally {
      setPending(null);
    }
  }

  const canManage = canManageWorkspace(workspace);

  return (
    <SectionShell
      title="Workspace settings"
      description="Identity, retention, security, and workspace creation."
      demoNotice={workspace?.demo}
      error={error}
      notice={notice}
    >
      {workspace && (
        <div className="settings-grid">
          <form className="panel settings-form" onSubmit={(event) => void saveWorkspace(event)}>
            <header className="panel-head">
              <h2>Workspace profile</h2>
              <Building2 size={15} />
            </header>
            <label>
              Name
              <input
                value={workspace.name}
                disabled={!canManage || workspace.demo}
                onChange={(event) => setWorkspace({ ...workspace, name: event.target.value })}
              />
            </label>
            <label>
              Slug
              <input
                value={workspace.slug}
                disabled={!canManage || workspace.demo}
                onChange={(event) =>
                  setWorkspace({ ...workspace, slug: event.target.value.toLowerCase() })
                }
              />
            </label>
            <label>
              Retention days
              <input
                type="number"
                min={1}
                max={3650}
                value={workspace.retentionDays}
                disabled={!canManage || workspace.demo}
                onChange={(event) =>
                  setWorkspace({ ...workspace, retentionDays: Number(event.target.value) })
                }
              />
            </label>
            <div className="muted">
              Signed in as {workspace.userEmail} · {workspace.role}
            </div>
            {canManage && !workspace.demo && (
              <button className="button-primary" disabled={pending === "workspace-save"}>
                <Save size={14} />
                Save settings
              </button>
            )}
          </form>
          {!workspace.demo && (
            <section className="panel settings-form">
              <header className="panel-head">
                <h2>Account security</h2>
                <KeyRound size={15} />
              </header>
              <p className="muted">Register this device as a passkey for passwordless sign-in.</p>
              <button
                className="button-secondary"
                onClick={() => void addPasskey()}
                disabled={pending === "passkey"}
              >
                <KeyRound size={14} />
                Add passkey
              </button>
            </section>
          )}
          {!workspace.demo && (
            <form className="panel settings-form" onSubmit={(event) => void createWorkspace(event)}>
              <header className="panel-head">
                <h2>New workspace</h2>
                <Plus size={15} />
              </header>
              <p className="muted">Create another isolated knowledge workspace and switch to it.</p>
              <label>
                Name
                <input
                  required
                  minLength={2}
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                />
              </label>
              <button className="button-secondary" disabled={pending === "workspace-create"}>
                <Plus size={14} />
                Create and switch
              </button>
            </form>
          )}
          <section className="panel definition-list">
            <div>
              <span>Document limit</span>
              <b>{workspace.maxDocuments}</b>
            </div>
            <div>
              <span>Storage limit</span>
              <b>{formatBytes(workspace.maxStorageBytes)}</b>
            </div>
            <div>
              <span>Member limit</span>
              <b>{workspace.maxMembers}</b>
            </div>
          </section>
        </div>
      )}
    </SectionShell>
  );
}
