"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/api-client";

export default function DemoEntry() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api("/demo-session", { method: "POST" })
      .then(() => window.location.assign("/app"))
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Demo access is unavailable."),
      );
  }, []);
  return (
    <main className="invite-layout">
      <section className="panel invite-card">
        <Logo />
        {error ? (
          <>
            <div className="notice error">
              <AlertCircle size={14} />
              {error}
            </div>
            <Link className="button-primary" href="/sign-in">
              Sign in instead
            </Link>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <h1>Preparing the demo…</h1>
            <p className="muted">Opening a public workspace with sample knowledge.</p>
          </>
        )}
      </section>
    </main>
  );
}
