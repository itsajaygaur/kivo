import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
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
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geist.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
