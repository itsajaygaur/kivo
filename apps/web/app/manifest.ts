import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kivo — AI Knowledge Base",
    short_name: "Kivo",
    description: "Answers grounded in your knowledge.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#211d16",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
