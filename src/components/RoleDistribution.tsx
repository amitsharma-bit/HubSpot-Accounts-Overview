"use client";

import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { TeamsResponse } from "@/lib/types";

const ROLE_ORDER = ["SDR", "AE", "SDR TL", "Manager", "Team Lead", "AM", "Other"];

export function RoleDistribution({
  selectedRole,
  onSelectRole,
}: {
  selectedRole: string | null;
  onSelectRole: (role: string | null) => void;
}) {
  const { data, loading, error } = useJson<TeamsResponse>("/api/teams");

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
          className={`card clickable${selectedRole === role ? " selected" : ""}`}
          style={{ padding: "0.5rem 0.9rem" }}
          onClick={() => onSelectRole(selectedRole === role ? null : role)}
        >
          <span style={{ fontWeight: 600 }}>{role}</span>{" "}
          <span className="muted">{totals[role].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
