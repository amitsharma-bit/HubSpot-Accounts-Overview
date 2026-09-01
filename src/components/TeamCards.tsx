"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { CardGridSkeleton } from "./Skeletons";
import { IconBadge } from "./Icon";
import type { TeamsResponse } from "@/lib/types";

const TEAM_COLORS = ["var(--accent)", "var(--color-purple)", "var(--color-orange)", "var(--color-teal)", "var(--color-slate)"];

export function TeamCards({
  selectedTeam,
  onSelectTeam,
}: {
  selectedTeam: string | null;
  onSelectTeam: (team: string | null) => void;
}) {
  const scope = useScopeParams();
  const { data, loading, error } = useJson<TeamsResponse>(`/api/teams?${scope.toString()}`);

  if (loading) return <CardGridSkeleton count={5} />;
  if (error || !data) return <div className="muted">Failed to load teams: {error}</div>;

  const visibleTeams = data.teams.filter((t) => t.memberCount > 0);
  if (visibleTeams.length === 0) return <div className="muted">No team members own an account in the current filter.</div>;

  // "Top Performing" is derived from the real, currently-filtered totals —
  // whichever team has the most accounts right now — never a fixed/fabricated label.
  const topTeam = visibleTeams.length > 1 ? visibleTeams.reduce((a, b) => (b.accountCount > a.accountCount ? b : a)) : null;

  return (
    <div className="card-grid">
      {visibleTeams.map((t, i) => {
        const color = TEAM_COLORS[i % TEAM_COLORS.length];
        const tlMgr = (t.roleBreakdown["Team Lead"] ?? 0) + (t.roleBreakdown["Manager"] ?? 0) + (t.roleBreakdown["AM"] ?? 0);
        return (
          <button
            key={t.team}
            className={`card clickable${selectedTeam === t.team ? " selected" : ""}`}
            onClick={() => onSelectTeam(selectedTeam === t.team ? null : t.team)}
          >
            <div className="card-top">
              <div>
                <div className="label" style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  {t.team}
                  {topTeam === t && <span className="top-badge">Top Performing</span>}
                </div>
                <div className="value">{t.accountCount.toLocaleString()}</div>
                <div className="sub">Accounts in the current filter</div>
              </div>
              <IconBadge name="building" color={color} />
            </div>
            <div className="stat-row">
              <div>
                Members
                <strong>{t.memberCount}</strong>
              </div>
              <div>
                SDR
                <strong>{t.roleBreakdown["SDR"] ?? 0}</strong>
              </div>
              <div>
                AE
                <strong>{t.roleBreakdown["AE"] ?? 0}</strong>
              </div>
              <div>
                TL/Mgr
                <strong>{tlMgr}</strong>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
