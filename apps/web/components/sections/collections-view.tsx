"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Folder, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  canManageWorkspace,
  collectionMemberIds,
  SectionShell,
  type Collection,
  type Invitation,
  type Member,
  type Workspace,
} from "./shared";

export function CollectionsView() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await api<{ data: Workspace }>("/workspace");
      setWorkspace(current.data);
      const [collectionData, memberData] = await Promise.all([
        api<{ data: Collection[] }>("/collections"),
        api<{ data: Member[]; invitations: Invitation[] }>("/members"),
      ]);
      setCollections(collectionData.data);
      setMembers(memberData.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

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

  const canManage = canManageWorkspace(workspace);

  return (
    <SectionShell
      title="Collections"
      description="Organize knowledge and control retrieval scope."
      error={error}
      notice={notice}
    >
      {canManage && (
        <form className="collection-create panel" onSubmit={(event) => void createCollection(event)}>
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
            canManage={Boolean(canManage && !(workspace?.demo && collection.id === "col_product"))}
            demo={Boolean(workspace?.demo)}
            pending={pending === collection.id}
            onChange={(next) =>
              setCollections((current) =>
                current.map((value, position) => (position === index ? next : value)),
              )
            }
            onSave={saveCollection}
            onDelete={(target) => setDeleting(target)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete collection"
        description={`Delete “${deleting?.name ?? ""}”? Documents will become unfiled.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await deleteCollection(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </SectionShell>
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
  onDelete: (collection: Collection) => void;
}) {
  const [selected, setSelected] = useState(() => collectionMemberIds(collection));
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
            onClick={() => onDelete(collection)}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </footer>
      )}
    </article>
  );
}
