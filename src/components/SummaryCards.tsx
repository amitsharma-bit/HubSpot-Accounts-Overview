"use client";

import { useJson } from "@/lib/useJson";
import { CardGridSkeleton } from "./Skeletons";
import type { OverviewResponse } from "@/lib/types";

export function SummaryCards() {
  const { data, loading, error } = useJson<OverviewResponse>("/api/overview");

  if (loading) return <CardGridSkeleton count={5} />;
  if (error || !data) return <div className="muted">Failed to load overview: {error}</div>;

  const pct = (n: number) => (data.totalUsAccounts ? `${((n / data.totalUsAccounts) * 100).toFixed(1)}% of total` : "");

  return (
    <div className="card-grid">
      <div className="card">
        <div className="label">Total US Accounts</div>
        <div className="value">{data.totalUsAccounts.toLocaleString()}</div>
        <div className="sub">country = United States / USA / US</div>
      </div>
      <div className="card">
        <div className="label">In Group Dealership</div>
        <div className="value">{data.inGroupDealership.toLocaleString()}</div>
        <div className="sub">{pct(data.inGroupDealership)}</div>
      </div>
      <div className="card">
        <div className="label">Franchise Accounts</div>
        <div className="value">{data.franchise.toLocaleString()}</div>
        <div className="sub">{pct(data.franchise)}</div>
      </div>
      <div className="card">
        <div className="label">Independent Accounts</div>
        <div className="value">{data.independent.toLocaleString()}</div>
        <div className="sub">{pct(data.independent)}</div>
      </div>
      <div className="card">
        <div className="label">Unowned US Accounts</div>
        <div className="value">{data.unownedUsAccounts.toLocaleString()}</div>
        <div className="sub">no Company owner set</div>
      </div>
      <div className="card">
        <div className="label">Not in Group Dealership</div>
        <div className="value">{data.notInGroupDealership.toLocaleString()}</div>
      </div>
      <div className="card">
        <div className="label">Group Dealership Flag Unset</div>
        <div className="value">{data.groupFlagUnassigned.toLocaleString()}</div>
        <div className="sub">not silently dropped, just unset on the record</div>
      </div>
      <div className="card">
        <div className="label">Companies with No Country</div>
        <div className="value">{data.countryUnassignedTotal.toLocaleString()}</div>
        <div className="sub">out of scope, logged for visibility</div>
      </div>
    </div>
  );
}
