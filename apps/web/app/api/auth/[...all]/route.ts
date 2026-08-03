import { bindings } from "@/lib/cloudflare";
import { createAuth } from "@/lib/auth";
async function handler(request: Request): Promise<Response> {
  const env = await bindings();
  if (!env)
    return Response.json({ error: "Auth requires the Cloudflare runtime." }, { status: 503 });
  return createAuth(env).handler(request);
}
export { handler as GET, handler as POST };
