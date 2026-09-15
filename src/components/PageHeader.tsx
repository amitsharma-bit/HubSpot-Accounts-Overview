"use client";

import { useState } from "react";
import { useJson } from "@/lib/useJson";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { data, loading, error } = useJson<{ computedAt: string }>("/api/status");
  const date = data ? new Date(data.computedAt) : null;
  const hasRefreshedAt = date && !Number.isNaN(date.getTime());

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Forces a real HubSpot sweep (the same one the hourly cron runs) via
  // /api/refresh-now, then reloads so every section picks up the fresh
  // snapshot — a plain reload alone (the previous behavior) just re-read the
  // same cached numbers, so "Last refreshed" never actually moved. The
  // cooldown/abuse protection lives server-side in that route, not here.
  async function refreshNow() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/refresh-now", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefreshError(body.error ?? "Refresh failed. Please try again.");
        setRefreshing(false);
        return;
      }
      window.location.reload();
    } catch {
      setRefreshError("Refresh failed. Please try again.");
      setRefreshing(false);
    }
  }

  return (
    <div className="page-header-row">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-right">
        {refreshError && (
          <div className="refreshed-text">
            <div className="refreshed-value" style={{ color: "var(--color-error)" }}>
              {refreshError}
            </div>
          </div>
        )}
        {!refreshError && !loading && !error && hasRefreshedAt && (
          <div className="refreshed-text">
            <div className="refreshed-label">Last refreshed</div>
            <div className="refreshed-value">{IST_FORMATTER.format(date)} IST</div>
          </div>
        )}
        <span className="live-pill">
          <span className="live-dot" />
          Live
        </span>
        <button
          className="icon-btn-round"
          onClick={refreshNow}
          disabled={refreshing}
          title={refreshing ? "Refreshing — this pulls a fresh sweep from HubSpot and can take up to a couple of minutes…" : "Refresh now"}
        >
          <Icon name="refresh" size={15} className={refreshing ? "icon-spin" : undefined} />
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
