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
    <>
      <div className="page-header">
        <h1>HubSpot US Accounts Overview</h1>
        <p>Real-time overview of HubSpot accounts (United States only) — every number computed server-side.</p>
      </div>

      <section className="section">
        <div className="section-title">Overview</div>
        <SummaryCards />
      </section>

      <section className="section">
        <div className="section-title">Teams</div>
        <TeamCards selectedTeam={team} onSelectTeam={(t) => setParam({ team: t, ownerId: null })} />
      </section>

      <section className="section">
        <div className="section-title">Role Distribution</div>
        <RoleDistribution selectedRole={role} onSelectRole={(r) => setParam({ role: r, ownerId: null })} />
      </section>

      <section className="section">
        <div className="section-title-row">
          <div className="section-title">Team Members{team ? ` — ${team}` : ""}</div>
        </div>
        <div className="table-card">
          <div className="table-scroll">
            <MemberTable
              team={team}
              role={role}
              selectedOwnerKey={ownerKey}
              onSelectOwner={(key) => setParam({ ownerId: key })}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">Accounts</div>
        <AccountsTable
          team={team}
          role={role}
          ownerKey={ownerKey}
          onSelectTeam={(t) => setParam({ team: t, ownerId: null })}
          onSelectRole={(r) => setParam({ role: r, ownerId: null })}
          onSelectOwner={(key) => setParam({ ownerId: key })}
        />
      </section>
    </>
  );
}
