"use client";

import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import { IconBadge } from "./Icon";
import type { UnmappedResponse } from "@/lib/types";

/**
 * Control Center's Team Members list (src/components/controlCenter) only
 * shows the curated dashboard directory, not every HubSpot user — this
 * component surfaces what that list deliberately excludes: the non-human
 * system/bulk-import buckets and the true no-owner-at-all count, both of
 * which affect account totals but aren't dashboard members to manage.
 */
export function UnmappedTable() {
  const { data, loading, error } = useJson<UnmappedResponse>(`/api/unmapped?page=1&pageSize=1`);

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load system buckets: {error}</div>;
  if (data.systemBuckets.length === 0 && data.unowned.count === 0) return null;

  return (
    <div className="section">
      <div className="section-title">System Buckets &amp; Unowned</div>
      <div className="card-grid">
        {data.systemBuckets.map((b) => (
          <div key={b.ownerId} className="card">
            <div className="card-top">
              <div>
                <div className="label">{b.name}</div>
                <div className="value">{b.count.toLocaleString()}</div>
                <div className="sub">bulk-import bucket, not a rep — owner ID {b.ownerId}</div>
              </div>
              <IconBadge name="layers" color="var(--color-slate)" />
            </div>
          </div>
        ))}
        <div className="card">
          <div className="card-top">
            <div>
              <div className="label">No Owner At All</div>
              <div className="value">{data.unowned.count.toLocaleString()}</div>
            </div>
            <IconBadge name="userX" color="var(--color-slate)" />
          </div>
        </div>
      </div>
    </div>
  );
}
