"use client";

import { useState } from "react";
import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { UnmappedResponse } from "@/lib/types";

export function UnmappedTable() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useJson<UnmappedResponse>(`/api/unmapped?page=${page}&pageSize=50`);

  if (loading && !data) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load unmapped owners: {error}</div>;

  return (
    <div>
      {data.systemBuckets.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="section-title">System / Bulk-Import Buckets</div>
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Owner ID</th>
                <th>US Accounts</th>
              </tr>
            </thead>
            <tbody>
              {data.systemBuckets.map((b) => (
                <tr key={b.ownerId}>
                  <td>{b.name}</td>
                  <td>{b.ownerId}</td>
                  <td>{b.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">
        Unmapped Owner ({data.total.toLocaleString()} HubSpot owner{data.total === 1 ? "" : "s"} with US accounts, not on
        the roster)
      </div>
      <p className="muted">
        Every owner below has at least one US account but is not assigned to a team in the roster config. Never
        silently excluded — add them to <code>src/config/roster.ts</code> to map them.
      </p>
      <table>
        <thead>
          <tr>
            <th>Owner</th>
            <th>Owner ID</th>
            <th>Status</th>
            <th>US Accounts</th>
          </tr>
        </thead>
        <tbody>
          {data.unmappedOwners.map((o) => (
            <tr key={o.ownerId}>
              <td>{o.name}</td>
              <td>{o.ownerId}</td>
              <td>{o.archived ? "archived" : "active"}</td>
              <td>{o.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination" style={{ marginTop: "0.5rem" }}>
        <span className="muted">
          Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}
        </span>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      <div className="card" style={{ marginTop: "1rem", maxWidth: 240 }}>
        <div className="label">No Owner At All</div>
        <div className="value">{data.unowned.count.toLocaleString()}</div>
      </div>
    </div>
  );
}
