import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";
// Both ship as variable fonts, so the full weight range costs one file each.
const sans = Archivo({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = Martian_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://kivo-web.workers.dev"),
  title: { default: "Kivo — Answers grounded in your knowledge", template: "%s · Kivo" },
  description: "Turn your team's documents into fast, cited, permission-aware answers.",
  applicationName: "Kivo",
  openGraph: {
    title: "Kivo — Answers grounded in your knowledge",
    description: "A secure AI knowledge base with citations you can trust.",
    type: "website",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0f" },
  ],
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
