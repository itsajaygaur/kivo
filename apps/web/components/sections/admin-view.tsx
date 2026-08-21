"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, RotateCcw, Save } from "lucide-react";
import { api } from "@/lib/api-client";
import { StatusStamp } from "@/components/ui/status-stamp";
import { SectionShell } from "./shared";

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

export function AdminView() {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAdmin((await api<{ data: AdminData }>("/admin")).data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <SectionShell
      title="Platform administration"
      description="Runtime health, workspace quotas, and suspension controls."
      error={error}
    >
      {admin && (
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
    </SectionShell>
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
        <StatusStamp failed={Boolean(organization.suspendedAt)}>
          {organization.suspendedAt ? "Suspended" : "Active"}
        </StatusStamp>
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
