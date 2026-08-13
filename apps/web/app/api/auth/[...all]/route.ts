import { bindings } from "@/lib/cloudflare";
import { createAuth } from "@/lib/auth";
async function handler(request: Request): Promise<Response> {
  const env = await bindings();
  if (!env)
    return Response.json({ error: "Auth requires the Cloudflare runtime." }, { status: 503 });
  // The organization plugin stays installed so sessions carry activeOrganizationId,
  // but its HTTP endpoints would bypass Kivo's workspace caps, settings bootstrap,
  // and role model, so they are not served.
  if (new URL(request.url).pathname.startsWith("/api/auth/organization"))
    return Response.json(
      { error: "Workspace management is only available through the Kivo API." },
      { status: 404 },
    );
  return createAuth(env).handler(request);
}
export { handler as GET, handler as POST };
