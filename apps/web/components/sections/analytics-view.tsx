"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatBytes } from "@/lib/api-client";
import { SectionShell, type Usage } from "./shared";

export function AnalyticsView() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsage((await api<{ data: Usage }>("/usage")).data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this section.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionShell
      title="Analytics"
      description="Live ingestion and capacity signals."
      error={error}
    >
      <div className="metric-grid">
        {[
          ["Documents", usage ? `${usage.documents} / ${usage.documentLimit}` : "—"],
          [
            "Storage",
            usage
              ? `${formatBytes(usage.storageBytes)} / ${formatBytes(usage.storageLimit)}`
              : "—",
          ],
          ["Members", usage ? `${usage.members} / ${usage.memberLimit}` : "—"],
        ].map(([label, value]) => (
          <article className="metric" key={label}>
            <div className="metric-top">{label}</div>
            <div className="metric-value">{value}</div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
