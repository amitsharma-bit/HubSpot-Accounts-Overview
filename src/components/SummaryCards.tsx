"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { CardGridSkeleton } from "./Skeletons";
import { IconBadge } from "./Icon";
import { Donut } from "./Donut";
import { sparkPaths, deltaOver } from "@/lib/spark";
import type { OverviewResponse } from "@/lib/types";

function Sparkline({
  history,
  metricKey,
  color,
}: {
  history: OverviewResponse["history"];
  metricKey: keyof NonNullable<OverviewResponse["history"]>[number];
  color: string;
}) {
  if (!history || history.length < 2) return null;
  const values = history.map((h) => Number(h[metricKey]));
  const { line, area } = sparkPaths(values);
  if (!line) return null;
  return (
    <svg width="100%" height={40} viewBox="0 0 220 46" preserveAspectRatio="none" className="spark-wrap">
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

function DeltaLine({
  history,
  metricKey,
}: {
  history: OverviewResponse["history"];
  metricKey: keyof NonNullable<OverviewResponse["history"]>[number];
}) {
  if (!history) return null;
  const delta = deltaOver(history, metricKey, 30);
  if (!delta) return <div className="spark-delta muted">Not enough history yet</div>;
  const up = delta.pct >= 0;
  return (
    <div className={`spark-delta ${up ? "up" : ""}`}>
      {up ? "▲" : "▼"} {Math.abs(delta.pct).toFixed(1)}% vs {delta.days} day{delta.days === 1 ? "" : "s"} ago
    </div>
  );
}

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
            <DeltaLine history={data.history} metricKey="totalUsAccounts" />
          </div>
          <IconBadge name="users" color="var(--accent)" />
        </div>
        <Sparkline history={data.history} metricKey="totalUsAccounts" color="var(--accent)" />
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">Single Independent Accounts</div>
            <div className="value">{data.independent.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.independent)}</div>
          </div>
          <Donut percent={pct(data.independent)} color="var(--color-orange)" />
        </div>
        <Sparkline history={data.history} metricKey="independent" color="var(--color-orange)" />
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">Single Franchise Accounts</div>
            <div className="value">{data.franchise.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.franchise)}</div>
          </div>
          <Donut percent={pct(data.franchise)} color="var(--accent-light)" />
        </div>
        <Sparkline history={data.history} metricKey="franchise" color="var(--accent-light)" />
      </div>

      <div className="card">
        <div className="card-top">
          <div>
            <div className="label">In Group Dealership</div>
            <div className="value">{data.inGroupDealership.toLocaleString()}</div>
            <div className="sub">{pctLabel(data.inGroupDealership)}</div>
          </div>
          <Donut percent={pct(data.inGroupDealership)} color="var(--color-purple)" />
        </div>
        <Sparkline history={data.history} metricKey="inGroupDealership" color="var(--color-purple)" />
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
          <IconBadge name="layers" color="var(--color-slate)" />
        </div>
      </div>
    </div>
  );
}
