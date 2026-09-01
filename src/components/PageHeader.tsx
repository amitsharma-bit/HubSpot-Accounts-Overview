"use client";

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

// "Refresh Now" reloads the page rather than forcing a new ~75s HubSpot
// sweep — the hourly cron job already keeps the Redis snapshot warm, and a
// full sweep triggered from an unauthenticated browser button would be a
// real abuse vector against HubSpot's rate limits. This just guarantees the
// visible numbers match whatever the last completed refresh produced.
function refreshNow() {
  window.location.reload();
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { data, loading, error } = useJson<{ computedAt: string }>("/api/status");
  const date = data ? new Date(data.computedAt) : null;
  const hasRefreshedAt = date && !Number.isNaN(date.getTime());

  return (
    <div className="page-header-row">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-right">
        {!loading && !error && hasRefreshedAt && (
          <div className="refreshed-text">
            <div className="refreshed-label">Last refreshed</div>
            <div className="refreshed-value">{IST_FORMATTER.format(date)} IST</div>
          </div>
        )}
        <span className="live-pill">
          <span className="live-dot" />
          Live
        </span>
        <button className="icon-btn-round" onClick={refreshNow} title="Refresh now">
          <Icon name="refresh" size={15} />
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
