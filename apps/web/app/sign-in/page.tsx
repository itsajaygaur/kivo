import Link from "next/link";
import { Code2, KeyRound } from "lucide-react";
import { Logo } from "@/components/logo";
export const metadata = { title: "Sign in" };
export default function SignIn() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--surface)",
      }}
    >
      <section style={{ padding: 32, display: "flex", flexDirection: "column" }}>
        <Logo />
        <div style={{ maxWidth: 370, width: "100%", margin: "auto" }}>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Secure workspace access
          </div>
          <h1 style={{ fontSize: 34, letterSpacing: "-.05em", margin: "20px 0 8px" }}>
            Welcome to Kivo
          </h1>
          <p className="muted" style={{ marginBottom: 28 }}>
            Sign in to ask better questions of your team’s knowledge.
          </p>
          <a
            className="button-secondary"
            href="/api/auth/sign-in/social?provider=google"
            style={{ width: "100%", marginBottom: 10 }}
          >
            G&nbsp;&nbsp;Continue with Google
          </a>
          <a
            className="button-secondary"
            href="/api/auth/sign-in/social?provider=github"
            style={{ width: "100%", marginBottom: 10 }}
          >
            <Code2 size={16} />
            Continue with GitHub
          </a>
          <a
            className="button-secondary"
            href="/api/auth/sign-in/passkey"
            style={{ width: "100%" }}
          >
            <KeyRound size={16} />
            Sign in with a passkey
          </a>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "24px 0",
              color: "var(--muted)",
              fontSize: 11,
            }}
          >
            <span style={{ height: 1, background: "var(--line)", flex: 1 }} />
            Portfolio preview
            <span style={{ height: 1, background: "var(--line)", flex: 1 }} />
          </div>
          <Link className="button-primary" href="/app" style={{ width: "100%" }}>
            Enter demo workspace
          </Link>
          <p className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 20 }}>
            By continuing, you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </section>
      <section
        className="noise"
        style={{
          background: "linear-gradient(145deg,#17152b,#292363)",
          margin: 12,
          borderRadius: 18,
          padding: 60,
          display: "flex",
          alignItems: "flex-end",
          color: "white",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 25, lineHeight: 1.4, letterSpacing: "-.035em" }}>
            “Kivo made our institutional memory feel less like an archive and more like a teammate
            who shows their work.”
          </p>
          <p style={{ opacity: 0.6 }}>Maya Chen · Head of Product at Northstar</p>
        </div>
      </section>
    </main>
  );
}
