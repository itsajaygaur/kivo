"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Code2, KeyRound, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function social(provider: "google" | "github") {
    setPending(provider);
    setError(null);
    const result = await authClient.signIn.social({ provider, callbackURL: "/app" });
    if (result.error) {
      setError(result.error.message ?? `Could not sign in with ${provider}.`);
      setPending(null);
    }
  }

  async function passkey() {
    setPending("passkey");
    setError(null);
    const result = await authClient.signIn.passkey();
    if (result?.error) {
      setError(result.error.message ?? "Could not sign in with a passkey.");
      setPending(null);
      return;
    }
    window.location.assign("/app");
  }

  return (
    <main className="sign-in-layout">
      <section className="sign-in-form">
        <Logo />
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Secure workspace access
          </div>
          <h1>Welcome to Kivo</h1>
          <p className="muted">Sign in to ask better questions of your team’s knowledge.</p>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <button
            className="button-secondary"
            onClick={() => void social("google")}
            disabled={Boolean(pending)}
          >
            {pending === "google" ? <LoaderCircle size={16} /> : "G"} Continue with Google
          </button>
          <button
            className="button-secondary"
            onClick={() => void social("github")}
            disabled={Boolean(pending)}
          >
            {pending === "github" ? <LoaderCircle size={16} /> : <Code2 size={16} />} Continue with
            GitHub
          </button>
          <button
            className="button-secondary"
            onClick={() => void passkey()}
            disabled={Boolean(pending)}
          >
            {pending === "passkey" ? <LoaderCircle size={16} /> : <KeyRound size={16} />} Sign in
            with a passkey
          </button>
          <div className="sign-in-divider">
            <span />
            Portfolio preview
            <span />
          </div>
          <Link className="button-primary" href="/app">
            Enter demo workspace
          </Link>
          <p className="muted terms">
            Demo access is available only when the deployment explicitly enables it.
          </p>
        </div>
      </section>
      <section className="sign-in-quote noise">
        <div>
          <p>Ask your knowledge base—and inspect exactly where every answer came from.</p>
          <span>Private, permission-aware retrieval</span>
        </div>
      </section>
    </main>
  );
}
