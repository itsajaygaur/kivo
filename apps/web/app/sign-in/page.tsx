"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Code2, KeyRound, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";

type Capabilities = {
  emailPassword: boolean;
  passkeys: boolean;
  github: boolean;
  google: boolean;
  demo: boolean;
};

export default function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [returnTo, setReturnTo] = useState("/app");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    if (requested?.startsWith("/") && !requested.startsWith("//")) setReturnTo(requested);
    void api<{ data: Capabilities }>("/auth-capabilities")
      .then(({ data }) => setCapabilities(data))
      .catch(() => setCapabilities(null));
    void authClient.getSession().then(async ({ data }) => {
      if (!data) return;
      const workspaces = await api<{ data: unknown[] }>("/workspaces").catch(() => ({ data: [] }));
      if (workspaces.data.length)
        window.location.assign(requested?.startsWith("/") ? requested : "/app");
      else setOnboarding(true);
    });
  }, []);

  async function createWorkspace() {
    if (workspaceName.trim().length < 2) return;
    setPending("workspace");
    setError(null);
    try {
      await api("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: workspaceName }),
      });
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your workspace.");
      setPending(null);
    }
  }

  async function credentials(event: FormEvent) {
    event.preventDefault();
    setPending("credentials");
    setError(null);
    if (mode === "sign-up") {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Could not create your account.");
        setPending(null);
        return;
      }
      if (returnTo.startsWith("/invite/")) window.location.assign(returnTo);
      else setOnboarding(true);
      setPending(null);
      return;
    }
    const result = await authClient.signIn.email({ email, password, rememberMe: true });
    if (result.error) {
      setError(result.error.message ?? "Email or password is incorrect.");
      setPending(null);
      return;
    }
    const workspaces = await api<{ data: unknown[] }>("/workspaces").catch(() => ({ data: [] }));
    if (returnTo.startsWith("/invite/")) window.location.assign(returnTo);
    else if (workspaces.data.length) window.location.assign("/app");
    else {
      setOnboarding(true);
      setPending(null);
    }
  }

  async function social(provider: "google" | "github") {
    setPending(provider);
    setError(null);
    const result = await authClient.signIn.social({
      provider,
      callbackURL: `/sign-in?continue=1&returnTo=${encodeURIComponent(returnTo)}`,
    });
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

  async function demo() {
    setPending("demo");
    setError(null);
    try {
      await api("/demo-session", { method: "POST" });
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo access is unavailable.");
      setPending(null);
    }
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
          <h1>
            {onboarding
              ? "Create your workspace"
              : mode === "sign-up"
                ? "Create an account"
                : "Welcome back"}
          </h1>
          <p className="muted">
            {onboarding
              ? "Your account is ready. Give the first workspace a name."
              : "Sign in to ask better questions of your team’s knowledge."}
          </p>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {onboarding ? (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createWorkspace();
              }}
            >
              <label>
                Workspace name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Acme Research"
                  autoFocus
                />
              </label>
              <button
                className="button-primary"
                disabled={Boolean(pending) || workspaceName.trim().length < 2}
              >
                {pending === "workspace" && <LoaderCircle size={16} />} Create workspace
              </button>
            </form>
          ) : (
            <>
              <form className="auth-form" onSubmit={(event) => void credentials(event)}>
                {mode === "sign-up" && (
                  <label>
                    Your name
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label>
                  Password
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  />
                </label>
                <button className="button-primary" disabled={Boolean(pending)}>
                  {pending === "credentials" && <LoaderCircle size={16} />}
                  {mode === "sign-up" ? "Create account" : "Sign in"}
                </button>
              </form>
              <button
                className="auth-mode-button"
                onClick={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
                }}
              >
                {mode === "sign-in"
                  ? "New to Kivo? Create an account"
                  : "Already have an account? Sign in"}
              </button>

              {(capabilities?.google || capabilities?.github || capabilities?.passkeys) && (
                <div className="sign-in-divider">
                  <span /> or continue with <span />
                </div>
              )}
              {capabilities?.google && (
                <button
                  className="button-secondary"
                  onClick={() => void social("google")}
                  disabled={Boolean(pending)}
                >
                  {pending === "google" ? <LoaderCircle size={16} /> : "G"} Continue with Google
                </button>
              )}
              {capabilities?.github && (
                <button
                  className="button-secondary"
                  onClick={() => void social("github")}
                  disabled={Boolean(pending)}
                >
                  {pending === "github" ? <LoaderCircle size={16} /> : <Code2 size={16} />} Continue
                  with GitHub
                </button>
              )}
              {capabilities?.passkeys && (
                <button
                  className="button-secondary"
                  onClick={() => void passkey()}
                  disabled={Boolean(pending)}
                >
                  {pending === "passkey" ? <LoaderCircle size={16} /> : <KeyRound size={16} />} Sign
                  in with a passkey
                </button>
              )}
              {capabilities?.demo && (
                <>
                  <div className="sign-in-divider">
                    <span /> public preview <span />
                  </div>
                  <button
                    className="button-secondary"
                    onClick={() => void demo()}
                    disabled={Boolean(pending)}
                  >
                    {pending === "demo" && <LoaderCircle size={16} />} Enter demo workspace
                  </button>
                </>
              )}
            </>
          )}
          <p className="muted terms">
            By continuing, you agree to Kivo’s <Link href="/privacy">privacy terms</Link>.
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
