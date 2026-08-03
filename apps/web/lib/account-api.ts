import { problem, sha256 } from "@kivo/shared";
import { z } from "zod";
import { getSessionIdentity, requireActor } from "./cloudflare";

const workspaceSchema = z.object({ name: z.string().trim().min(2).max(100) });

function demoCookie(request: Request, enabled: boolean) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `kivo_demo=${enabled ? "1" : ""}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${enabled ? 60 * 60 * 24 : 0}`;
}

function baseSlug(name: string) {
  return (
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "workspace"
  );
}

async function availableSlug(env: Env, name: string) {
  const base = baseSlug(name);
  for (let suffix = 0; suffix < 100; suffix++) {
    const slug = suffix ? `${base}-${suffix + 1}` : base;
    const existing = await env.DB.prepare("SELECT id FROM organization WHERE slug=?")
      .bind(slug)
      .first();
    if (!existing) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function handleAccountRoute(
  request: Request,
  path: string[],
  env: Env,
): Promise<Response | null> {
  if (path[0] === "auth-capabilities" && request.method === "GET")
    return Response.json({
      data: {
        emailPassword: true,
        passkeys: true,
        github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        demo: env.KIVO_DEMO_MODE === "true",
      },
    });

  if (path[0] === "demo-session" && request.method === "POST") {
    if (env.KIVO_DEMO_MODE !== "true")
      return problem(404, "Demo unavailable", "This deployment does not expose demo access.");
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": demoCookie(request, true), "cache-control": "no-store" },
    });
  }

  if (path[0] === "demo-session" && request.method === "DELETE")
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": demoCookie(request, false), "cache-control": "no-store" },
    });

  if (path[0] === "workspaces" && request.method === "GET" && !path[1]) {
    const identity = await getSessionIdentity(request, env);
    if (!identity) {
      try {
        const demo = await requireActor(request, env);
        if (demo.isDemo)
          return Response.json({
            data: [
              {
                id: demo.organizationId,
                name: "Acme Research",
                slug: "acme-research",
                role: demo.role,
                active: true,
                demo: true,
              },
            ],
          });
      } catch {
        return problem(401, "Authentication required", "Sign in to list your workspaces.");
      }
    }
    if (!identity)
      return problem(401, "Authentication required", "Sign in to list your workspaces.");
    const result = await env.DB.prepare(
      `SELECT o.id,o.name,o.slug,m.role,
              CASE WHEN o.id=? THEN 1 ELSE 0 END AS active
       FROM member m JOIN organization o ON o.id=m.organization_id
       WHERE m.user_id=? AND o.deleted_at IS NULL AND o.suspended_at IS NULL
       ORDER BY active DESC,o.name`,
    )
      .bind(identity.activeOrganizationId ?? "", identity.userId)
      .all();
    return Response.json({ data: result.results });
  }

  if (path[0] === "workspaces" && request.method === "POST" && !path[1]) {
    const identity = await getSessionIdentity(request, env);
    if (!identity) return problem(401, "Authentication required", "Sign in to create a workspace.");
    const parsed = workspaceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid workspace",
        parsed.error.issues[0]?.message ?? "Enter a workspace name.",
      );
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM member WHERE user_id=?")
      .bind(identity.userId)
      .first<{ total: number }>();
    if ((count?.total ?? 0) >= 10)
      return problem(
        409,
        "Workspace limit reached",
        "An account can belong to up to 10 workspaces.",
      );
    const organizationId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const slug = await availableSlug(env, parsed.data.name);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO organization(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)",
      ).bind(organizationId, parsed.data.name, slug, now, now),
      env.DB.prepare(
        "INSERT INTO workspace_settings(organization_id,created_at,updated_at) VALUES(?,?,?)",
      ).bind(organizationId, now, now),
      env.DB.prepare(
        "INSERT INTO member(id,organization_id,user_id,role,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).bind(memberId, organizationId, identity.userId, "owner", now, now),
      env.DB.prepare(
        "UPDATE session SET active_organization_id=?,updated_at=? WHERE id=? AND user_id=?",
      ).bind(organizationId, now, identity.sessionId, identity.userId),
      env.DB.prepare(
        "INSERT INTO audit_log(id,organization_id,actor_id,action,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        organizationId,
        identity.userId,
        "workspace.created",
        "workspace",
        organizationId,
        JSON.stringify({ name: parsed.data.name }),
        now,
      ),
    ]);
    return Response.json(
      { data: { id: organizationId, name: parsed.data.name, slug, role: "owner", active: true } },
      { status: 201, headers: { "set-cookie": demoCookie(request, false) } },
    );
  }

  if (path[0] === "workspaces" && path[1] && path[2] === "activate" && request.method === "POST") {
    const identity = await getSessionIdentity(request, env);
    if (!identity) return problem(401, "Authentication required", "Sign in to switch workspaces.");
    const membership = await env.DB.prepare(
      `SELECT m.id FROM member m JOIN organization o ON o.id=m.organization_id
       WHERE m.user_id=? AND m.organization_id=? AND o.deleted_at IS NULL AND o.suspended_at IS NULL`,
    )
      .bind(identity.userId, path[1])
      .first();
    if (!membership)
      return problem(
        403,
        "Workspace unavailable",
        "You are not an active member of that workspace.",
      );
    await env.DB.prepare(
      "UPDATE session SET active_organization_id=?,updated_at=? WHERE id=? AND user_id=?",
    )
      .bind(path[1], Date.now(), identity.sessionId, identity.userId)
      .run();
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": demoCookie(request, false) },
    });
  }

  if (path[0] === "invitations" && path[1] && request.method === "GET") {
    const tokenHash = await sha256(path[1]);
    const invitation = await env.DB.prepare(
      `SELECT i.email,i.role,i.status,i.expires_at AS expiresAt,o.name AS workspaceName
       FROM invitation i JOIN organization o ON o.id=i.organization_id
       WHERE i.token_hash=? AND o.deleted_at IS NULL`,
    )
      .bind(tokenHash)
      .first();
    if (!invitation) return problem(404, "Invitation not found", "This invitation is invalid.");
    return Response.json({ data: invitation });
  }

  if (path[0] === "invitations" && path[1] && request.method === "POST") {
    const identity = await getSessionIdentity(request, env);
    if (!identity)
      return problem(401, "Authentication required", "Sign in to accept this invitation.");
    const tokenHash = await sha256(path[1]);
    const invitation = await env.DB.prepare(
      `SELECT i.id,i.organization_id AS organizationId,i.email,i.role,i.status,i.expires_at AS expiresAt
       FROM invitation i JOIN organization o ON o.id=i.organization_id
       WHERE i.token_hash=? AND o.suspended_at IS NULL AND o.deleted_at IS NULL`,
    )
      .bind(tokenHash)
      .first<{
        id: string;
        organizationId: string;
        email: string;
        role: "owner" | "admin" | "editor" | "viewer";
        status: string;
        expiresAt: number;
      }>();
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt < Date.now())
      return problem(
        410,
        "Invitation expired",
        "Ask a workspace administrator for a new invitation.",
      );
    if (invitation.email.toLowerCase() !== identity.email.toLowerCase())
      return problem(
        403,
        "Email mismatch",
        `Sign in as ${invitation.email} to accept this invitation.`,
      );
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO member(id,organization_id,user_id,role,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        invitation.organizationId,
        identity.userId,
        invitation.role,
        now,
        now,
      ),
      env.DB.prepare("UPDATE invitation SET status='accepted',updated_at=? WHERE id=?").bind(
        now,
        invitation.id,
      ),
      env.DB.prepare(
        "UPDATE session SET active_organization_id=?,updated_at=? WHERE id=? AND user_id=?",
      ).bind(invitation.organizationId, now, identity.sessionId, identity.userId),
      env.DB.prepare(
        "INSERT INTO audit_log(id,organization_id,actor_id,action,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        invitation.organizationId,
        identity.userId,
        "invitation.accepted",
        "invitation",
        invitation.id,
        "{}",
        now,
      ),
    ]);
    return Response.json(
      { data: { organizationId: invitation.organizationId } },
      { headers: { "set-cookie": demoCookie(request, false) } },
    );
  }

  return null;
}
