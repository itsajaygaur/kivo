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
};
export async function requireActor(request: Request, runtime?: Env | null): Promise<Actor> {
  const env = runtime ?? (await bindings());
  if (env?.KIVO_DEMO_MODE === "true" || process.env.KIVO_DEMO_MODE === "true")
    return { userId: "usr_demo", organizationId: "org_kivo", role: "owner" };
  if (!env) throw new Error("UNAUTHENTICATED");
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) throw new Error("UNAUTHENTICATED");
  const activeOrganizationId = session.session.activeOrganizationId;
  const membership = activeOrganizationId
    ? await env.DB.prepare(
        "SELECT m.organization_id AS organizationId,m.role FROM member m JOIN organization o ON o.id=m.organization_id WHERE m.user_id=? AND m.organization_id=? AND o.suspended_at IS NULL AND o.deleted_at IS NULL",
      )
        .bind(session.user.id, activeOrganizationId)
        .first<{ organizationId: string; role: Actor["role"] }>()
    : await env.DB.prepare(
        "SELECT m.organization_id AS organizationId,m.role FROM member m JOIN organization o ON o.id=m.organization_id WHERE m.user_id=? AND o.suspended_at IS NULL AND o.deleted_at IS NULL ORDER BY m.created_at LIMIT 1",
      )
        .bind(session.user.id)
        .first<{ organizationId: string; role: Actor["role"] }>();
  if (!membership) throw new Error("UNAUTHENTICATED");
  return { userId: session.user.id, ...membership };
}
