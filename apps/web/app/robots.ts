import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/security", "/privacy"],
        disallow: ["/app/", "/api/", "/sign-in"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://kivo-web.workers.dev"}/sitemap.xml`,
  };
}
