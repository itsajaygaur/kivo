"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { api, formatRelativeTime } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusStamp } from "@/components/ui/status-stamp";
import {
  canManageWorkspace,
  SectionShell,
  type Invitation,
  type Member,
  type Workspace,
} from "./shared";

export function MembersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteUrl, setInviteUrl] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await api<{ data: Workspace }>("/workspace");
      setWorkspace(current.data);
      const response = await api<{ data: Member[]; invitations: Invitation[] }>("/members");
      setMembers(response.data);
      setInvitations(response.invitations);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const canManage = canManageWorkspace(workspace);

  return (
    <SectionShell
      title="Members"
      description="Invite people and manage workspace roles."
      demoNotice={workspace?.demo}
      error={error}
    >
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
                    <StatusStamp>{member.role}</StatusStamp>
                  )}
                </td>
                <td className="muted">{formatRelativeTime(member.joinedAt)}</td>
                {canManage && !workspace?.demo && (
                  <td>
                    <button
                      className="icon-button danger"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setRemoving(member)}
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
                  {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
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
      <ConfirmDialog
        open={removing !== null}
        title="Remove member"
        description={`Remove ${removing?.name ?? ""} from this workspace?`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removing) await removeMember(removing);
        }}
        onClose={() => setRemoving(null)}
      />
    </SectionShell>
  );
}
