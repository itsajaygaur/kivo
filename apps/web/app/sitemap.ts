import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const root = process.env.NEXT_PUBLIC_APP_URL ?? "https://kivo-web.workers.dev";
  return ["", "/docs", "/security", "/privacy"].map((path) => ({
    url: `${root}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.7 : 1,
  }));
}
