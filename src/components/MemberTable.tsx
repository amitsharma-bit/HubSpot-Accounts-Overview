"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { TableSkeleton } from "./Skeletons";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./Badge";
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
  const params = useScopeParams();
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
              className={`clickable-row${isSelected ? " row-selected" : ""}`}
              onClick={() => onSelectOwner(isSelected ? null : ownerKey)}
            >
              <td>
                <span className="person">
                  <Avatar name={m.name} />
                  {m.name}
                  {m.isMerged && <span className="chip">merged owner IDs</span>}
                </span>
              </td>
              <td>
                <RoleBadge role={m.role} />
              </td>
              <td>{m.team}</td>
              <td>{m.accountCount.toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
