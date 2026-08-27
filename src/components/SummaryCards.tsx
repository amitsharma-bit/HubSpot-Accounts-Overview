"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { CardGridSkeleton } from "./Skeletons";
import { IconBadge } from "./Icon";
import { Donut } from "./Donut";
import type { OverviewResponse } from "@/lib/types";

export function SummaryCards() {
  const scope = useScopeParams();
  const { data, loading, error } = useJson<OverviewResponse>(`/api/overview?${scope.toString()}`);

  if (loading) return <CardGridSkeleton count={5} />;
  if (error || !data) return <div className="muted">Failed to load overview: {error}</div>;

  const pct = (n: number) => (data.totalUsAccounts ? (n / data.totalUsAccounts) * 100 : 0);
  const pctLabel = (n: number) => `${pct(n).toFixed(1)}% of total`;

  return (
    <div className="card-grid">
      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">Total US Accounts</div>
            <div className="value">{data.totalUsAccounts.toLocaleString()}</div>
            <div className="sub">country_dropdown = United States</div>
          </div>
          <IconBadge name="users" color="#4F46E5" />
        </div>
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">Single Independent Accounts</div>
            <div className="value">{data.independent.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.independent)}</div>
          </div>
          <Donut percent={pct(data.independent)} color="#F59E0B" />
        </div>
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">Single Franchise Accounts</div>
            <div className="value">{data.franchise.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.franchise)}</div>
          </div>
          <Donut percent={pct(data.franchise)} color="#10B981" />
        </div>
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">In Group Dealership</div>
            <div className="value">{data.inGroupDealership.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.inGroupDealership)}</div>
          </div>
          <Donut percent={pct(data.inGroupDealership)} color="#8B5CF6" />
        </div>
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">SalesOps-Owned Accounts</div>
            <div className="value">{data.salesOps.accounts.toLocaleString()}</div>
            <div className="sub">
              {data.salesOps.owners.length > 0
                ? `Held by ${data.salesOps.owners.map((o) => o.name).join(", ")} — a bulk-import/holding owner, not an individual rep`
                : "No SalesOps-owned accounts in the current filter"}
            </div>
          </div>
          <IconBadge name="layers" color="#6B7280" />
        </div>
      </div>
    </div>
  );
}
