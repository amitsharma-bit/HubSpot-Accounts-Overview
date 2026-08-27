"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { TableSkeleton } from "./Skeletons";
import { ROLE_ORDER } from "@/config/roster";
import type { TeamsResponse } from "@/lib/types";

export function RoleDistribution({
  selectedRole,
  onSelectRole,
}: {
  selectedRole: string | null;
  onSelectRole: (role: string | null) => void;
}) {
  const scope = useScopeParams();
  const { data, loading, error } = useJson<TeamsResponse>(`/api/teams?${scope.toString()}`);

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load role distribution: {error}</div>;

  const totals: Record<string, number> = {};
  for (const t of data.teams) {
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
