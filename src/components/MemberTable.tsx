"use client";

import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { MemberTotal } from "@/lib/types";

export function MemberTable({
  team,
  role,
  selectedOwnerKey,
  onSelectOwner,
}: {
  team: string | null;
  role: string | null;
  selectedOwnerKey: string | null;
  onSelectOwner: (ownerKey: string | null) => void;
}) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  if (role) params.set("role", role);
  const { data, loading, error } = useJson<{ members: MemberTotal[] }>(`/api/members?${params.toString()}`);

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load members: {error}</div>;
  if (data.members.length === 0) return <div className="muted">No members match the current filters.</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Team</th>
          <th>US Accounts</th>
        </tr>
      </thead>
      <tbody>
        {data.members.map((m) => {
          const ownerKey = m.ownerIds.join(",");
          const isSelected = selectedOwnerKey === ownerKey;
          return (
            <tr
              key={ownerKey}
              className="clickable-row"
              style={isSelected ? { background: "rgba(99,102,241,0.12)" } : undefined}
              onClick={() => onSelectOwner(isSelected ? null : ownerKey)}
            >
              <td>
                {m.name}
                {m.isMerged && <span className="chip" style={{ marginLeft: "0.4rem" }}>merged owner IDs</span>}
              </td>
              <td>{m.role}</td>
              <td>{m.team}</td>
              <td>{m.accountCount.toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
