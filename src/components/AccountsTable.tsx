"use client";

import { useEffect, useState } from "react";
import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { fmt, fmtDate } from "@/lib/format";
import { TableSkeleton } from "./Skeletons";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { DealershipClassBadge } from "./Badge";
import { ROLE_ORDER } from "@/config/roster";
import type { AccountsResponse, MemberTotal } from "@/lib/types";

export function AccountsTable({
  team,
  role,
  ownerKey,
  onSelectTeam,
  onSelectRole,
  onSelectOwner,
}: {
  team: string | null;
  role: string | null;
  ownerKey: string | null;
  onSelectTeam: (team: string | null) => void;
  onSelectRole: (role: string | null) => void;
  onSelectOwner: (ownerKey: string | null) => void;
}) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input -> query param, server-side search only.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const scope = useScopeParams();
  // Any filter change resets to page 1. Adjusted during render (not an effect)
  // per React's "adjusting state when a prop changes" pattern — avoids an
  // extra render pass from setState-in-effect.
  const filterKey = JSON.stringify({ team, role, ownerKey, q, scope: scope.toString() });
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const memberParams = new URLSearchParams();
  if (team) memberParams.set("team", team);
  const { data: memberData } = useJson<{ members: MemberTotal[] }>(`/api/members?${memberParams.toString()}`);
  const { data: rosterData } = useJson<{ pods: string[] }>("/api/roster");

  const params = new URLSearchParams(scope);
  params.set("page", String(page));
  if (team) params.set("team", team);
  if (role) params.set("role", role);
  if (ownerKey) params.set("ownerId", ownerKey);
  if (q) params.set("q", q);

  const { data, loading, error } = useJson<AccountsResponse>(`/api/accounts?${params.toString()}`);

  return (
    <div className="table-card">
      <div style={{ padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div className="filter-bar">
          <label className="search-box">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search company, domain, or owner name…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </label>
          <select value={role ?? ""} onChange={(e) => onSelectRole(e.target.value || null)}>
            <option value="">All Roles</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={team ?? ""} onChange={(e) => onSelectTeam(e.target.value || null)}>
            <option value="">All Teams</option>
            {(rosterData?.pods ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={ownerKey ?? ""} onChange={(e) => onSelectOwner(e.target.value || null)}>
            <option value="">All Members</option>
            {(memberData?.members ?? []).map((m) => (
              <option key={m.ownerIds.join(",")} value={m.ownerIds.join(",")}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar">
          {team && (
            <span className="chip">
              Team: {team} <button onClick={() => onSelectTeam(null)}>&times;</button>
            </span>
          )}
          {role && (
            <span className="chip">
              Role: {role} <button onClick={() => onSelectRole(null)}>&times;</button>
            </span>
          )}
          {ownerKey && (
            <span className="chip">
              Member selected <button onClick={() => onSelectOwner(null)}>&times;</button>
            </span>
          )}
        </div>
      </div>

      {loading && <TableSkeleton />}
      {error && <div className="muted" style={{ padding: "0 0.9rem 0.9rem" }}>Failed to load accounts: {error}</div>}
      {data && data.rows.length === 0 && (
        <div className="muted" style={{ padding: "0 0.9rem 0.9rem" }}>No accounts match the current filters.</div>
      )}
      {data && data.rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Domain</th>
                  <th>Owner</th>
                  <th>Team</th>
                  <th>Country</th>
                  <th>State</th>
                  <th>City</th>
                  <th>Type of Dealership</th>
                  <th>GD Name</th>
                  <th>Potential Rooftops</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmt(r.name)}</td>
                    <td>{fmt(r.domain)}</td>
                    <td>
                      {r.ownerName ? (
                        <span className="person">
                          <Avatar name={r.ownerName} size={26} />
                          {r.ownerName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{fmt(r.team)}</td>
                    <td>{fmt(r.country)}</td>
                    <td>{fmt(r.state)}</td>
                    <td>{fmt(r.city)}</td>
                    <td>
                      <DealershipClassBadge dealershipClass={r.dealershipClass} />
                    </td>
                    <td>{r.inGroupDealership ? fmt(r.gdName) : "—"}</td>
                    <td>{r.potentialRooftops ?? "—"}</td>
                    <td>{fmtDate(r.lastActivityDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
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
