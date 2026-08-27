"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { TableSkeleton } from "./Skeletons";
import { ROLE_ORDER } from "@/config/roster";
import type { TeamsResponse, MemberTotal } from "@/lib/types";

export function RoleDistribution({
  team,
  selectedRole,
  onSelectRole,
}: {
  team: string | null;
  selectedRole: string | null;
  onSelectRole: (role: string | null) => void;
}) {
  const scope = useScopeParams();

  // When a team is selected, roles come from that team's actual members —
  // never show a role no one on the team has. Reuses /api/members, which is
  // already scoped to both the team and the active sidebar filters, so
  // per-role counts stay correct without a second aggregation path.
  const memberParams = new URLSearchParams(scope);
  if (team) memberParams.set("team", team);
  const { data: memberData, loading: memberLoading, error: memberError } = useJson<{ members: MemberTotal[] }>(
    `/api/members?${memberParams.toString()}`
  );

  // No team selected: fall back to the global per-role totals across every team.
  const { data: teamsData, loading: teamsLoading, error: teamsError } = useJson<TeamsResponse>(
    team ? null : `/api/teams?${scope.toString()}`
  );

  if (team) {
    if (memberLoading) return <TableSkeleton />;
    if (memberError || !memberData) return <div className="muted">Failed to load role distribution: {memberError}</div>;

    const totals: Record<string, number> = {};
    for (const m of memberData.members) totals[m.role] = (totals[m.role] ?? 0) + m.accountCount;
    const teamTotal = memberData.members.reduce((sum, m) => sum + m.accountCount, 0);
    const activeRoles = ROLE_ORDER.filter((r) => totals[r] !== undefined);

    return (
      <div className="filter-bar">
        <button className={`pill${selectedRole === null ? " selected" : ""}`} onClick={() => onSelectRole(null)}>
          All <span className="count">{teamTotal.toLocaleString()}</span>
        </button>
        {activeRoles.map((role) => (
          <button
            key={role}
            className={`pill${selectedRole === role ? " selected" : ""}`}
            onClick={() => onSelectRole(selectedRole === role ? null : role)}
          >
            {role} <span className="count">{totals[role].toLocaleString()}</span>
          </button>
        ))}
      </div>
    );
  }

  if (teamsLoading) return <TableSkeleton />;
  if (teamsError || !teamsData) return <div className="muted">Failed to load role distribution: {teamsError}</div>;

  const totals: Record<string, number> = {};
  for (const t of teamsData.teams) {
    for (const [role, count] of Object.entries(t.roleBreakdown)) {
      totals[role] = (totals[role] ?? 0) + count;
    }
  }

  return (
    <div className="filter-bar">
      {ROLE_ORDER.filter((r) => totals[r] !== undefined).map((role) => (
        <button
          key={role}
          className={`pill${selectedRole === role ? " selected" : ""}`}
          onClick={() => onSelectRole(selectedRole === role ? null : role)}
        >
          {role} <span className="count">{totals[role].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
