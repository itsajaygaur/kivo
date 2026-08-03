import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "./auth";
export async function bindings(): Promise<Env | null> {
  try {
    return (await getCloudflareContext({ async: true })).env as Env;
  } catch {
    return null;
  }
}
export type Actor = {
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  userEmail: string;
  isDemo: boolean;
  isPlatformAdmin: boolean;
};

export type SessionIdentity = {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  activeOrganizationId: string | null;
};

function hasDemoCookie(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .some((part) => part.trim() === "kivo_demo=1");
}

function platformAdmin(env: Env, email: string) {
  return (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function getSessionIdentity(
  request: Request,
  runtime?: Env | null,
): Promise<SessionIdentity | null> {
  const env = runtime ?? (await bindings());
  if (!env) return null;
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return null;
  const userStatus = await env.DB.prepare("SELECT suspended_at AS suspendedAt FROM user WHERE id=?")
    .bind(session.user.id)
    .first<{ suspendedAt: number | null }>();
  if (!userStatus || userStatus.suspendedAt) return null;
  return {
    sessionId: session.session.id,
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  };
}

export async function requireActor(request: Request, runtime?: Env | null): Promise<Actor> {
  const env = runtime ?? (await bindings());
  if (!env) throw new Error("UNAUTHENTICATED");
  const identity = await getSessionIdentity(request, env);
  if (!identity) {
    if (
      (env.KIVO_DEMO_MODE === "true" || process.env.KIVO_DEMO_MODE === "true") &&
      hasDemoCookie(request)
    )
      return {
        userId: "usr_demo",
        userEmail: "demo@kivo.local",
        organizationId: "org_kivo",
        role: "owner",
        isDemo: true,
        isPlatformAdmin: false,
      };
    throw new Error("UNAUTHENTICATED");
  }
  const activeOrganizationId = identity.activeOrganizationId;
  const membership = activeOrganizationId
    ? await env.DB.prepare(
        "SELECT m.organization_id AS organizationId,m.role FROM member m JOIN organization o ON o.id=m.organization_id WHERE m.user_id=? AND m.organization_id=? AND o.suspended_at IS NULL AND o.deleted_at IS NULL",
      )
        .bind(identity.userId, activeOrganizationId)
        .first<{ organizationId: string; role: Actor["role"] }>()
    : await env.DB.prepare(
        "SELECT m.organization_id AS organizationId,m.role FROM member m JOIN organization o ON o.id=m.organization_id WHERE m.user_id=? AND o.suspended_at IS NULL AND o.deleted_at IS NULL ORDER BY m.created_at LIMIT 1",
      )
        .bind(identity.userId)
        .first<{ organizationId: string; role: Actor["role"] }>();
  if (!membership) throw new Error("UNAUTHENTICATED");
  return {
    userId: identity.userId,
    userEmail: identity.email,
    ...membership,
    isDemo: false,
    isPlatformAdmin: platformAdmin(env, identity.email),
  };
}
