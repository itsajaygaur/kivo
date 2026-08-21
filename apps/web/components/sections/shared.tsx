import { Shield } from "lucide-react";
import { Notice } from "@/components/ui/notice";

export type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  restricted: number;
  documentCount: number;
  memberIds: string | string[];
};
export type Member = { id: string; name: string; email: string; role: string; joinedAt: number };
export type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: number;
  createdAt: number;
};
export type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: number;
  actorName: string;
};
export type Usage = {
  documents: number;
  documentLimit: number;
  storageBytes: number;
  storageLimit: number;
  members: number;
  memberLimit: number;
};
export type Workspace = {
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

export function collectionMemberIds(collection: Collection) {
  if (Array.isArray(collection.memberIds)) return collection.memberIds;
  try {
    return JSON.parse(collection.memberIds) as string[];
  } catch {
    return [];
  }
}

export function canManageWorkspace(workspace: Workspace | null) {
  return workspace?.role === "owner" || workspace?.role === "admin";
}

export function SectionShell({
  title,
  description,
  demoNotice,
  error,
  notice,
  children,
}: {
  title: string;
  description: string;
  demoNotice?: boolean | undefined;
  error: string | null;
  notice?: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {demoNotice && (
        <div className="notice" role="status">
          <Shield size={15} /> Shared demo access protects membership and workspace settings. Create
          a free account to use these controls.
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {children}
    </div>
  );
}
