"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  Folder,
  KeyRound,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { api, formatBytes, formatRelativeTime } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

const content = {
  collections: {
    title: "Collections",
    description: "Organize knowledge and control retrieval scope.",
  },
  members: { title: "Members", description: "Invite people and manage workspace roles." },
  analytics: { title: "Analytics", description: "Live ingestion and capacity signals." },
  audit: { title: "Audit log", description: "Recorded workspace changes." },
  settings: {
    title: "Workspace settings",
    description: "Identity, retention, security, and workspace creation.",
  },
  admin: {
    title: "Platform administration",
    description: "Runtime health, workspace quotas, and suspension controls.",
  },
} as const;

type Kind = keyof typeof content;
type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  restricted: number;
  documentCount: number;
  memberIds: string | string[];
};
type Member = { id: string; name: string; email: string; role: string; joinedAt: number };
type Invitation = { id: string; email: string; role: string; expiresAt: number; createdAt: number };
type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: number;
  actorName: string;
};
type Usage = {
  documents: number;
  documentLimit: number;
  storageBytes: number;
  storageLimit: number;
  members: number;
  memberLimit: number;
};
type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
  userName: string;
  userEmail: string;
  retentionDays: number;
  maxDocuments: number;
  maxStorageBytes: number;
  maxMembers: number;
  demo: boolean;
  platformAdmin: boolean;
};
type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  suspendedAt: number | null;
  createdAt: number;
  maxDocuments: number;
  maxStorageBytes: number;
  maxMembers: number;
  members: number;
  documents: number;
};
type AdminData = {
  health: Record<string, unknown>;
  organizations: AdminOrganization[];
};

function memberIds(collection: Collection) {
  if (Array.isArray(collection.memberIds)) return collection.memberIds;
  try {
    return JSON.parse(collection.memberIds) as string[];
  } catch {
    return [];
  }
}

export function SectionPage({ kind }: { kind: Kind }) {
  const item = content[kind];
  const [collections, setCollections] = useState<Collection[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteUrl, setInviteUrl] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await api<{ data: Workspace }>("/workspace");
      setWorkspace(current.data);
      if (kind === "collections") {
        const [collectionData, memberData] = await Promise.all([
          api<{ data: Collection[] }>("/collections"),
          api<{ data: Member[]; invitations: Invitation[] }>("/members"),
        ]);
        setCollections(collectionData.data);
        setMembers(memberData.data);
      }
      if (kind === "members") {
        const response = await api<{ data: Member[]; invitations: Invitation[] }>("/members");
        setMembers(response.data);
        setInvitations(response.invitations);
      }
      if (kind === "audit") setEvents((await api<{ data: AuditEvent[] }>("/audit")).data);
      if (kind === "analytics") setUsage((await api<{ data: Usage }>("/usage")).data);
      if (kind === "admin") setAdmin((await api<{ data: AdminData }>("/admin")).data);
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
    setPending("collection-create");
    try {
      await api("/collections", {
        method: "POST",
        body: JSON.stringify({ name, description, restricted }),
      });
      setName("");
      setDescription("");
      setRestricted(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the collection.");
    } finally {
      setPending(null);
    }
  }

  async function saveCollection(collection: Collection, selectedMemberIds: string[]) {
    setPending(collection.id);
    setError(null);
    try {
      await api(`/collections/${collection.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: collection.name,
          description: collection.description ?? "",
          color: collection.color,
          restricted: Boolean(collection.restricted),
        }),
      });
      if (!workspace?.demo)
        await api(`/collections/${collection.id}/members`, {
          method: "PUT",
          body: JSON.stringify({ memberIds: selectedMemberIds }),
        });
      setNotice("Collection saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the collection.");
    } finally {
      setPending(null);
    }
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`Delete “${collection.name}”? Documents will become unfiled.`)) return;
    setPending(collection.id);
    try {
      await api(`/collections/${collection.id}`, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the collection.");
    } finally {
      setPending(null);
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setPending("invite");
    setInviteUrl("");
    try {
      const response = await api<{ data: { inviteUrl: string } }>("/members", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteUrl(response.data.inviteUrl);
      setInviteEmail("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the invitation.");
    } finally {
      setPending(null);
    }
  }

  async function updateRole(member: Member, role: string) {
    setPending(member.id);
    try {
      await api(`/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the member.");
    } finally {
      setPending(null);
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from this workspace?`)) return;
    setPending(member.id);
    try {
      await api(`/members/${member.id}`, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the member.");
    } finally {
      setPending(null);
    }
  }

  async function cancelInvitation(invitation: Invitation) {
    setPending(invitation.id);
    try {
      await api(`/invitations/${invitation.id}`, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel the invitation.");
    } finally {
      setPending(null);
    }
  }

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
    const result = await authClient.passkey.addPasskey({ name: "Kivo passkey" });
    if (result.error) setError(result.error.message ?? "Could not register the passkey.");
    else setNotice("Passkey registered.");
    setPending(null);
  }

  async function updateOrganization(id: string, changes: Record<string, unknown>) {
    setPending(id);
    try {
      await api(`/admin/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the workspace.");
    } finally {
      setPending(null);
    }
  }

  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
      </div>
      {workspace?.demo && (kind === "members" || kind === "settings") && (
        <div className="notice">
          <Shield size={15} /> Shared demo access protects membership and workspace settings. Create
          a free account to use these controls.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {notice && (
        <div className="notice">
          <CheckCircle2 size={15} />
          {notice}
        </div>
      )}

      {kind === "collections" && (
        <>
          {canManage && (
            <form
              className="collection-create panel"
              onSubmit={(event) => void createCollection(event)}
            >
              <input
                aria-label="Collection name"
                placeholder="New collection name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                aria-label="Collection description"
                placeholder="Description (optional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={restricted}
                  onChange={(event) => setRestricted(event.target.checked)}
                />{" "}
                Restricted
              </label>
              <button
                className="button-primary"
                disabled={pending === "collection-create" || name.trim().length < 2}
              >
                <Plus size={14} />
                Create
              </button>
            </form>
          )}
          <div className="management-grid">
            {collections.map((collection, index) => (
              <CollectionEditor
                key={collection.id}
                collection={collection}
                members={members}
                canManage={Boolean(
                  canManage && !(workspace?.demo && collection.id === "col_product"),
                )}
                demo={Boolean(workspace?.demo)}
                pending={pending === collection.id}
                onChange={(next) =>
                  setCollections((current) =>
                    current.map((value, position) => (position === index ? next : value)),
                  )
                }
                onSave={saveCollection}
                onDelete={deleteCollection}
              />
            ))}
          </div>
        </>
      )}

      {kind === "members" && (
        <>
          {canManage && !workspace?.demo && (
            <form className="inline-form panel" onSubmit={(event) => void invite(event)}>
              <input
                required
                type="email"
                aria-label="Invite email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <select
                aria-label="Invite role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button className="button-primary" disabled={pending === "invite"}>
                <UserPlus size={14} />
                Invite
              </button>
            </form>
          )}
          {inviteUrl && (
            <div className="notice invite-link">
              <span>{inviteUrl}</span>
              <button
                className="icon-button"
                aria-label="Copy invitation link"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                <Copy size={14} />
              </button>
            </div>
          )}
          <section className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Joined</th>
                  {canManage && !workspace?.demo && <th />}
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
                      {canManage && !workspace?.demo ? (
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={member.role}
                          disabled={pending === member.id}
                          onChange={(event) => void updateRole(member, event.target.value)}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="status">{member.role}</span>
                      )}
                    </td>
                    <td className="muted">{formatRelativeTime(member.joinedAt)}</td>
                    {canManage && !workspace?.demo && (
                      <td>
                        <button
                          className="icon-button danger"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => void removeMember(member)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {invitations.length > 0 && (
            <section className="panel">
              <header className="panel-head">
                <h2>Pending invitations</h2>
              </header>
              {invitations.map((invitation) => (
                <div className="event-row" key={invitation.id}>
                  <span className="feature-icon">
                    <UserPlus size={13} />
                  </span>
                  <div>
                    <b>{invitation.email}</b>
                    <div className="muted">
                      {invitation.role} · expires{" "}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="button-secondary compact"
                    onClick={() => void cancelInvitation(invitation)}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
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
                  {event.actorName} · {event.targetType} · {formatRelativeTime(event.createdAt)}
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

      {kind === "settings" && workspace && (
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

      {kind === "admin" && admin && (
        <>
          <section className="panel definition-list">
            {Object.entries(admin.health).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <b>{String(value)}</b>
              </div>
            ))}
          </section>
          <div className="management-grid">
            {admin.organizations.map((organization) => (
              <AdminOrganizationCard
                key={organization.id}
                organization={organization}
                pending={pending === organization.id}
                onSave={updateOrganization}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CollectionEditor({
  collection,
  members,
  canManage,
  demo,
  pending,
  onChange,
  onSave,
  onDelete,
}: {
  collection: Collection;
  members: Member[];
  canManage: boolean;
  demo: boolean;
  pending: boolean;
  onChange: (collection: Collection) => void;
  onSave: (collection: Collection, memberIds: string[]) => Promise<void>;
  onDelete: (collection: Collection) => Promise<void>;
}) {
  const [selected, setSelected] = useState(() => memberIds(collection));
  return (
    <article className="panel collection-editor">
      <header>
        <span className="feature-icon" style={{ color: collection.color }}>
          <Folder size={17} />
        </span>
        <div>
          <b>{collection.documentCount} documents</b>
          <div className="muted">{collection.restricted ? "Restricted" : "Workspace-wide"}</div>
        </div>
      </header>
      <label>
        Name
        <input
          value={collection.name}
          disabled={!canManage}
          onChange={(event) => onChange({ ...collection, name: event.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          value={collection.description ?? ""}
          disabled={!canManage}
          onChange={(event) => onChange({ ...collection, description: event.target.value })}
        />
      </label>
      {canManage && (
        <div className="collection-options">
          <label>
            Color
            <input
              type="color"
              value={collection.color}
              onChange={(event) => onChange({ ...collection, color: event.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(collection.restricted)}
              onChange={(event) =>
                onChange({ ...collection, restricted: event.target.checked ? 1 : 0 })
              }
            />{" "}
            Restricted
          </label>
        </div>
      )}
      {collection.restricted && !demo && canManage && (
        <fieldset>
          <legend>Allowed members</legend>
          {members.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                checked={selected.includes(member.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, member.id]
                      : selected.filter((id) => id !== member.id),
                  )
                }
              />
              {member.name} <span className="muted">({member.role})</span>
            </label>
          ))}
        </fieldset>
      )}
      {canManage && (
        <footer>
          <button
            className="button-primary compact"
            disabled={pending}
            onClick={() => void onSave(collection, selected)}
          >
            <Save size={13} />
            Save
          </button>
          <button
            className="button-secondary compact danger"
            disabled={pending}
            onClick={() => void onDelete(collection)}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </footer>
      )}
    </article>
  );
}

function AdminOrganizationCard({
  organization,
  pending,
  onSave,
}: {
  organization: AdminOrganization;
  pending: boolean;
  onSave: (id: string, changes: Record<string, unknown>) => Promise<void>;
}) {
  const [documents, setDocuments] = useState(organization.maxDocuments);
  const [members, setMembers] = useState(organization.maxMembers);
  const [storage, setStorage] = useState(organization.maxStorageBytes);
  return (
    <article className="panel settings-form">
      <header className="panel-head">
        <div>
          <h2>{organization.name}</h2>
          <div className="muted">{organization.slug}</div>
        </div>
        <span className={`status ${organization.suspendedAt ? "failed" : ""}`}>
          {organization.suspendedAt ? "Suspended" : "Active"}
        </span>
      </header>
      <div className="muted">
        {organization.documents} documents · {organization.members} members
      </div>
      <label>
        Document limit
        <input
          type="number"
          min={1}
          value={documents}
          onChange={(event) => setDocuments(Number(event.target.value))}
        />
      </label>
      <label>
        Member limit
        <input
          type="number"
          min={1}
          value={members}
          onChange={(event) => setMembers(Number(event.target.value))}
        />
      </label>
      <label>
        Storage bytes
        <input
          type="number"
          min={1048576}
          value={storage}
          onChange={(event) => setStorage(Number(event.target.value))}
        />
      </label>
      <footer>
        <button
          className="button-primary compact"
          disabled={pending}
          onClick={() =>
            void onSave(organization.id, {
              maxDocuments: documents,
              maxMembers: members,
              maxStorageBytes: storage,
            })
          }
        >
          <Save size={13} />
          Save quotas
        </button>
        <button
          className="button-secondary compact"
          disabled={pending}
          onClick={() => void onSave(organization.id, { suspended: !organization.suspendedAt })}
        >
          {organization.suspendedAt ? <RotateCcw size={13} /> : <Ban size={13} />}
          {organization.suspendedAt ? "Restore" : "Suspend"}
        </button>
      </footer>
    </article>
  );
}
