"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

type Invitation = {
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  workspaceName: string;
};

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api<{ data: Invitation }>(`/invitations/${token}`), authClient.getSession()])
      .then(([invite, session]) => {
        setInvitation(invite.data);
        setSignedIn(Boolean(session.data));
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Invitation unavailable."),
      );
  }, [token]);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await api(`/invitations/${token}`, { method: "POST" });
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not accept the invitation.");
      setPending(false);
    }
  }

  return (
    <main className="invite-layout">
      <section className="panel invite-card">
        <Logo />
        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {!invitation && !error && <LoaderCircle className="spin" />}
        {invitation && (
          <>
            <span className="feature-icon">
              <CheckCircle2 size={18} />
            </span>
            <h1>Join {invitation.workspaceName}</h1>
            <p className="muted">
              You were invited as <b>{invitation.role}</b> using {invitation.email}.
            </p>
            {invitation.status !== "pending" || invitation.expiresAt < Date.now() ? (
              <div className="notice error">This invitation is no longer active.</div>
            ) : signedIn ? (
              <button className="button-primary" onClick={() => void accept()} disabled={pending}>
                {pending && <LoaderCircle size={15} />} Accept invitation
              </button>
            ) : (
              <Link className="button-primary" href={`/sign-in?returnTo=/invite/${token}`}>
                Sign in or create an account
              </Link>
            )}
          </>
        )}
      </section>
    </main>
  );
}
