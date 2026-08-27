"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { CardGridSkeleton } from "./Skeletons";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./Badge";
import type { MemberTotal } from "@/lib/types";

/**
 * Renamed in spirit but kept the filename/export (MemberTable) so nothing
 * importing it needs to change — this used to render a row table, now a
 * compact card grid. Same data source (/api/members), same filter/role/team
 * scoping, just a different presentation.
 */
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

  if (loading) return <CardGridSkeleton count={6} />;
  if (error || !data) return <div className="muted">Failed to load members: {error}</div>;
  if (data.members.length === 0) return <div className="muted">No members match the current filters.</div>;

  return (
    <div className="member-card-grid">
      {data.members.map((m) => {
        const ownerKey = m.ownerIds.join(",");
        const isSelected = selectedOwnerKey === ownerKey;
        return (
          <button
            key={ownerKey}
            className={`member-card${isSelected ? " selected" : ""}`}
            onClick={() => onSelectOwner(isSelected ? null : ownerKey)}
          >
            <div className="member-card-name">
              <Avatar name={m.name} size={30} />
              <span>{m.name}</span>
            </div>
            <div className="member-card-meta">
              <RoleBadge role={m.role} />
              <span className="member-card-team">{m.team}</span>
              {m.isMerged && <span className="chip">merged owner IDs</span>}
            </div>
            <div>
              <div className="member-card-count">{m.accountCount.toLocaleString()}</div>
              <div className="member-card-count-label">Total Accounts</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
