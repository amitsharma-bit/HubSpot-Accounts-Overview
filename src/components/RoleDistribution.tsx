"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { TableSkeleton } from "./Skeletons";
import { ROLE_ORDER } from "@/config/roster";
import { ROLE_COLORS } from "./Badge";
import type { TeamsResponse, MemberTotal } from "@/lib/types";

function RoleDonutLegend({
  totals,
  total,
  selectedRole,
  onSelectRole,
}: {
  totals: Record<string, number>;
  total: number;
  selectedRole: string | null;
  onSelectRole: (role: string | null) => void;
}) {
  const roles = ROLE_ORDER.filter((r) => totals[r] !== undefined && totals[r] > 0);
  const R = 50;
  const RC = 2 * Math.PI * R;
  // Built via reduce (rather than a mutated running-total variable) so the
  // per-role dash/offset math stays a pure function of `roles` each render.
  const arcs = roles.reduce<{ role: string; color: string; dash: number; offset: number }[]>((out, role) => {
    const consumed = out.reduce((sum, a) => sum + a.dash, 0);
    const frac = total > 0 ? totals[role] / total : 0;
    out.push({ role, color: ROLE_COLORS[role] ?? "var(--color-slate)", dash: frac * RC, offset: -consumed });
    return out;
  }, []);

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">Role Distribution</div>
        <div className="muted">{total.toLocaleString()} total</div>
      </div>
      <div className="donut-row">
        <div className="donut-holder">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--bg)" strokeWidth="18" />
            {arcs.map((a) => (
              <circle
                key={a.role}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="18"
                strokeDasharray={`${a.dash.toFixed(1)} ${RC.toFixed(1)}`}
                strokeDashoffset={a.offset.toFixed(1)}
                strokeLinecap={arcs.length > 1 ? "butt" : "round"}
                transform="rotate(-90 60 60)"
              />
            ))}
          </svg>
          <div className="donut-center">
            <div className="donut-big">{total.toLocaleString()}</div>
            <div className="donut-small">Total</div>
          </div>
        </div>
        <div className="legend-col">
          <button
            className={`legend-row${selectedRole === null ? " selected" : ""}`}
            onClick={() => onSelectRole(null)}
          >
            <span className="legend-dot" style={{ background: "var(--muted-2)" }} />
            <span className="legend-label">All roles</span>
            <span className="legend-count">{total.toLocaleString()}</span>
          </button>
          {roles.map((role) => (
            <button
              key={role}
              className={`legend-row${selectedRole === role ? " selected" : ""}`}
              onClick={() => onSelectRole(selectedRole === role ? null : role)}
            >
              <span className="legend-dot" style={{ background: ROLE_COLORS[role] ?? "var(--color-slate)" }} />
              <span className="legend-label">{role}</span>
              <span className="legend-count">
                {totals[role].toLocaleString()} ({total > 0 ? ((totals[role] / total) * 100).toFixed(1) : "0.0"}%)
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

    return <RoleDonutLegend totals={totals} total={teamTotal} selectedRole={selectedRole} onSelectRole={onSelectRole} />;
  }

  if (teamsLoading) return <TableSkeleton />;
  if (teamsError || !teamsData) return <div className="muted">Failed to load role distribution: {teamsError}</div>;

  const totals: Record<string, number> = {};
  for (const t of teamsData.teams) {
    for (const [role, count] of Object.entries(t.roleBreakdown)) {
      totals[role] = (totals[role] ?? 0) + count;
    }
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  return <RoleDonutLegend totals={totals} total={total} selectedRole={selectedRole} onSelectRole={onSelectRole} />;
}
