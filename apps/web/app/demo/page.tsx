"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
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
            <Notice error>{error}</Notice>
            <Link className="button-primary" href="/sign-in">
              Sign in instead
            </Link>
          </>
        ) : (
          <>
            <Spinner size={18} />
            <h1>Preparing the demo…</h1>
            <p className="muted">Opening a public workspace with sample knowledge.</p>
          </>
        )}
      </section>
    </main>
  );
}
