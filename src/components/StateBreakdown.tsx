"use client";

import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { TableSkeleton } from "./Skeletons";

const MAX_ROWS = 8;

export function StateBreakdown() {
  const scope = useScopeParams();
  const { data, loading, error } = useJson<{ states: { value: string; count: number }[] }>(
    `/api/state-breakdown?${scope.toString()}`
  );

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load state breakdown: {error}</div>;
  if (data.states.length === 0) return <div className="muted">No accounts match the current filters.</div>;

  const top = data.states.slice(0, MAX_ROWS);
  const max = top[0].count;

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">Accounts by State</div>
        <div className="muted">
          Top {top.length} of {data.states.length}
        </div>
      </div>
      <div className="state-list">
        {top.map((s) => (
          <div className="state-row" key={s.value}>
            <span className="state-row-name">{s.value}</span>
            <span className="state-row-track">
              <span className="state-row-fill" style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <span className="state-row-count">{s.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
