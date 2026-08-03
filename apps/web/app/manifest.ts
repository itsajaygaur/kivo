import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kivo — AI Knowledge Base",
    short_name: "Kivo",
    description: "Answers grounded in your knowledge.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0c0c0e",
    theme_color: "#5652e8",
    icons: [],
  };
}
