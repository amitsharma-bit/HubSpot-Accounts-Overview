"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SummaryCards } from "./SummaryCards";
import { TeamCards } from "./TeamCards";
import { RoleDistribution } from "./RoleDistribution";
import { MemberTable } from "./MemberTable";
import { AccountsTable } from "./AccountsTable";

export function OverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const team = searchParams.get("team");
  const role = searchParams.get("role");
  const ownerKey = searchParams.get("ownerId");

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.push(`/?${next.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div>
      <h1>HubSpot US Accounts Overview</h1>
      <p className="muted">Real-time overview of HubSpot accounts (United States only).</p>

      <section>
        <div className="section-title">Overview</div>
        <SummaryCards />
      </section>

      <section>
        <div className="section-title">Teams</div>
        <TeamCards selectedTeam={team} onSelectTeam={(t) => setParam({ team: t, ownerId: null })} />
      </section>

      <section>
        <div className="section-title">Role Distribution</div>
        <RoleDistribution selectedRole={role} onSelectRole={(r) => setParam({ role: r, ownerId: null })} />
      </section>

      <section>
        <div className="section-title">Team Members{team ? ` — ${team}` : ""}</div>
        <MemberTable
          team={team}
          role={role}
          selectedOwnerKey={ownerKey}
          onSelectOwner={(key) => setParam({ ownerId: key })}
        />
      </section>

      <section>
        <div className="section-title">Accounts</div>
        <AccountsTable
          team={team}
          role={role}
          ownerKey={ownerKey}
          onClearTeam={() => setParam({ team: null, ownerId: null })}
          onClearRole={() => setParam({ role: null })}
          onClearOwner={() => setParam({ ownerId: null })}
        />
      </section>
    </div>
  );
}
