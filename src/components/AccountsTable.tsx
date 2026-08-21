"use client";

import { useEffect, useState } from "react";
import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { AccountsResponse } from "@/lib/types";

export function AccountsTable({
  team,
  role,
  ownerKey,
  onClearTeam,
  onClearRole,
  onClearOwner,
}: {
  team: string | null;
  role: string | null;
  ownerKey: string | null;
  onClearTeam: () => void;
  onClearRole: () => void;
  onClearOwner: () => void;
}) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [typeOfDealership, setTypeOfDealership] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input -> query param, server-side search only.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // Any filter change resets to page 1. Adjusted during render (not an effect)
  // per React's "adjusting state when a prop changes" pattern — avoids an
  // extra render pass from setState-in-effect.
  const filterKey = JSON.stringify({ team, role, ownerKey, q, city, state, typeOfDealership });
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const params = new URLSearchParams({ page: String(page) });
  if (team) params.set("team", team);
  if (role) params.set("role", role);
  if (ownerKey) params.set("ownerId", ownerKey);
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (typeOfDealership) params.set("typeOfDealership", typeOfDealership);
  if (q) params.set("q", q);

  const { data, loading, error } = useJson<AccountsResponse>(`/api/accounts?${params.toString()}`);

  return (
    <div>
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search company, domain, or owner name…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <select value={typeOfDealership} onChange={(e) => setTypeOfDealership(e.target.value)}>
          <option value="">All Types</option>
          <option value="Franchise">Franchise</option>
          <option value="Independent">Independent</option>
        </select>
      </div>

      <div className="filter-bar" style={{ marginTop: "0.4rem" }}>
        {team && (
          <span className="chip">
            Team: {team} <button onClick={onClearTeam}>&times;</button>
          </span>
        )}
        {role && (
          <span className="chip">
            Role: {role} <button onClick={onClearRole}>&times;</button>
          </span>
        )}
        {ownerKey && (
          <span className="chip">
            Owner selected <button onClick={onClearOwner}>&times;</button>
          </span>
        )}
      </div>

      {loading && <TableSkeleton />}
      {error && <div className="muted">Failed to load accounts: {error}</div>}
      {data && data.rows.length === 0 && <div className="muted">No accounts match the current filters.</div>}
      {data && data.rows.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Domain</th>
                <th>Owner</th>
                <th>Team</th>
                <th>Role</th>
                <th>GD Name</th>
                <th>Type</th>
                <th>City</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.domain}</td>
                  <td>{r.ownerName}</td>
                  <td>{r.team ?? "—"}</td>
                  <td>{r.role ?? "—"}</td>
                  <td>{r.inGroupDealership ? r.gdName ?? "—" : "—"}</td>
                  <td>{r.typeOfDealership}</td>
                  <td>{r.city}</td>
                  <td>{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination" style={{ marginTop: "0.5rem" }}>
            <span className="muted">
              Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of{" "}
              {data.total.toLocaleString()}
              {data.cappedByHubSpot ? " (refine filters — HubSpot caps paged browsing at 10,000 rows)" : ""}
            </span>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              View More
            </button>
          </div>
        </>
      )}
    </div>
  );
}
