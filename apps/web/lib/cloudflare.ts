import { getCloudflareContext } from "@opennextjs/cloudflare";
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
export async function requireActor(): Promise<Actor> {
  const env = await bindings();
  if (env?.KIVO_DEMO_MODE === "true" || process.env.KIVO_DEMO_MODE === "true")
    return { userId: "usr_demo", organizationId: "org_kivo", role: "owner" };
  throw new Error("UNAUTHENTICATED");
}
