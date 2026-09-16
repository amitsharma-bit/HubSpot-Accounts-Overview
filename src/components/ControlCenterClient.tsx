"use client";

import { useState } from "react";
import { useJson } from "@/lib/useJson";
import { TeamManagementBar } from "./controlCenter/TeamManagementBar";
import { TeamsSummary } from "./controlCenter/TeamsSummary";
import { MembersDirectory } from "./controlCenter/MembersDirectory";
import { TableSkeleton } from "./Skeletons";
import type { DashboardTeam, DashboardMember } from "@/lib/rosterStore";

export function ControlCenterClient() {
  const [refetchKey, setRefetchKey] = useState(0);
  const { data, loading } = useJson<{ teams: DashboardTeam[]; members: DashboardMember[] }>(`/api/roster?r=${refetchKey}`);

  if (loading || !data) return <TableSkeleton />;

  const refresh = () => setRefetchKey((k) => k + 1);
  const activeTeams = data.teams.filter((t) => t.status === "active");

  return (
    <div className="section">
      <TeamManagementBar teams={activeTeams} onChanged={refresh} />
      <TeamsSummary teams={data.teams} members={data.members} onChanged={refresh} />
      <MembersDirectory teams={activeTeams} onChanged={refresh} />
    </div>
  );
}
