"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "./PageHeader";
import { SummaryCards } from "./SummaryCards";
import { TeamCards } from "./TeamCards";
import { RoleDistribution } from "./RoleDistribution";
import { StateBreakdown } from "./StateBreakdown";
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
      <PageHeader
        title="HubSpot US Accounts Overview"
        subtitle="Real-time overview of HubSpot accounts (United States only) — every number computed server-side."
      />

      <section className="section">
        <div className="section-title">Overview</div>
        <SummaryCards />
      </section>

      <section className="section">
        <div className="section-title">Teams</div>
        <TeamCards selectedTeam={team} onSelectTeam={(t) => setParam({ team: t, ownerId: null })} />
      </section>

      <section className="section">
        <div className="panel-grid">
          <RoleDistribution team={team} selectedRole={role} onSelectRole={(r) => setParam({ role: r, ownerId: null })} />
          <StateBreakdown />
        </div>
      </section>

      <section className="section">
        <div className="section-title-row">
          <div className="section-title">Team Members{team ? ` — ${team}` : ""}</div>
        </div>
        <MemberTable
          team={team}
          role={role}
          selectedOwnerKey={ownerKey}
          onSelectOwner={(key) => setParam({ ownerId: key })}
        />
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
