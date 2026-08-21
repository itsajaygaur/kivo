"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Shield } from "lucide-react";
import { api, formatRelativeTime } from "@/lib/api-client";
import { SectionShell, type AuditEvent } from "./shared";

export function AuditView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents((await api<{ data: AuditEvent[] }>("/audit")).data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionShell title="Audit log" description="Recorded workspace changes." error={error}>
      <section className="panel">
        <header className="panel-head">
          <h2>Recent events</h2>
          <Shield size={14} className="muted" />
        </header>
        {events.map((event) => (
          <div className="event-row" key={event.id}>
            <span className="feature-icon">
              <Activity size={13} />
            </span>
            <div>
              <b>{event.action.replaceAll(".", " ")}</b>
              <div className="muted">
                {event.actorName} · {event.targetType} · {formatRelativeTime(event.createdAt)}
              </div>
            </div>
          </div>
        ))}
        {!events.length && <div className="empty-cell">No recorded events yet.</div>}
      </section>
    </SectionShell>
  );
}
