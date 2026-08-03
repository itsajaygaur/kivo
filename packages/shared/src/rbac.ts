import type { Role } from "./contracts";

export const permissions = [
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "members:manage",
  "quota:manage",
  "documents:read",
  "documents:write",
  "documents:delete",
  "chat:use",
  "analytics:read",
  "apiKeys:manage",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(permissions),
  admin: new Set(
    permissions.filter((permission) => !["workspace:delete", "quota:manage"].includes(permission)),
  ),
  editor: new Set([
    "workspace:read",
    "documents:read",
    "documents:write",
    "documents:delete",
    "chat:use",
  ]),
  viewer: new Set(["workspace:read", "documents:read", "chat:use"]),
};

export function can(role: Role, permission: Permission): boolean {
  return grants[role].has(permission);
}
export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new AuthorizationError(permission);
}
export class AuthorizationError extends Error {
  constructor(public readonly permission: Permission) {
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
  }
}

export function canAccessCollection(
  role: Role,
  memberCollectionIds: readonly string[],
  collectionId: string,
  restricted: boolean,
): boolean {
  return (
    !restricted ||
    role === "owner" ||
    role === "admin" ||
    memberCollectionIds.includes(collectionId)
  );
}
