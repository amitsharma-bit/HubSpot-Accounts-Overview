"use client";

import { useJson } from "@/lib/useJson";
import { CardGridSkeleton } from "./Skeletons";
import type { TeamsResponse } from "@/lib/types";

export function TeamCards({
  selectedTeam,
  onSelectTeam,
}: {
  selectedTeam: string | null;
  onSelectTeam: (team: string | null) => void;
}) {
  const { data, loading, error } = useJson<TeamsResponse>("/api/teams");

  if (loading) return <CardGridSkeleton count={5} />;
  if (error || !data) return <div className="muted">Failed to load teams: {error}</div>;

  const systemTotal = data.systemBuckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div>
      <div className="card-grid">
        {data.teams.map((t) => (
          <button
            key={t.team}
            className={`card clickable${selectedTeam === t.team ? " selected" : ""}`}
            onClick={() => onSelectTeam(selectedTeam === t.team ? null : t.team)}
          >
            <div className="label">{t.team}</div>
            <div className="value">{t.accountCount.toLocaleString()}</div>
            <div className="sub">{t.memberCount} members</div>
          </button>
        ))}
      </div>

      <div className="card-grid" style={{ marginTop: "0.75rem" }}>
        {data.systemBuckets.map((b) => (
          <div key={b.ownerId} className="card">
            <div className="label">{b.name}</div>
            <div className="value">{b.count.toLocaleString()}</div>
            <div className="sub">bulk-import bucket, not a rep</div>
          </div>
        ))}
        <div className="card">
          <div className="label">Unmapped Owner</div>
          <div className="value">{data.unmapped.count.toLocaleString()}</div>
          <div className="sub">
            {data.unmapped.ownerCount} owner{data.unmapped.ownerCount === 1 ? "" : "s"} not in any team &middot; see Control Center
          </div>
        </div>
        <div className="card">
          <div className="label">No Owner</div>
          <div className="value">{data.unowned.toLocaleString()}</div>
        </div>
      </div>
      {systemTotal + data.unmapped.count > 0 && (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Teams above cover a minority of all US accounts — the rest sit in the bulk-import bucket or with owners outside
          the roster. Nothing is excluded from the Total US Accounts count.
        </p>
      )}
    </div>
  );
}
