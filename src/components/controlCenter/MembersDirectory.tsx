"use client";

import { useState } from "react";
import { useJson } from "@/lib/useJson";
import { Drawer } from "@/components/Drawer";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/Badge";
import { ROLE_ORDER } from "@/config/roster";
import type { DashboardTeam } from "@/lib/rosterStore";
import type { MemberRow } from "@/app/api/roster/members/route";

const INITIAL_LIMIT = 25;
const LOAD_MORE_STEP = 20;

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json;
}

export function MembersDirectory({ teams, onChanged }: { teams: DashboardTeam[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "deactivated" | "all">("active");
  const [teamFilter, setTeamFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset the accumulated page whenever a filter changes, during render
  // (this codebase's established pattern) rather than an effect.
  const filterKey = JSON.stringify({ q, statusFilter, teamFilter, roleFilter });
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLimit(INITIAL_LIMIT);
  }

  const params = new URLSearchParams({ status: statusFilter, limit: String(limit) });
  if (teamFilter) params.set("team", teamFilter);
  if (roleFilter) params.set("role", roleFilter);
  if (q) params.set("q", q);

  const { data, loading, error } = useJson<{ total: number; members: MemberRow[] }>(`/api/roster/members?${params.toString()}`);

  async function runAction(memberId: string, body: Record<string, unknown>) {
    setActionError(null);
    try {
      await patchJson("/api/roster/members", { memberId, ...body });
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">Team Members</div>
        <span className="muted">{data ? `${data.total.toLocaleString()} ${statusFilter === "all" ? "" : statusFilter} member${data.total === 1 ? "" : "s"}` : ""}</span>
      </div>

      <div className="filter-bar">
        <label className="search-box-compact" style={{ width: 220 }}>
          <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
          <option value="all">All</option>
        </select>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.teamName}
            </option>
          ))}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="Not Configured">Not Configured</option>
        </select>
      </div>

      {actionError && (
        <p className="muted" style={{ color: "var(--color-error)" }}>
          {actionError}
        </p>
      )}
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load members: {error}</div>}
      {!loading && data && data.members.length === 0 && <div className="muted">No members match the current filters.</div>}

      {!loading && data && data.members.length > 0 && (
        <div className="table-card" style={{ boxShadow: "none" }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>HubSpot Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.memberId}>
                    <td>
                      <span className="person">
                        <Avatar name={m.name} size={24} />
                        {m.name}
                        {m.isMerged && <span className="chip">merged</span>}
                      </span>
                    </td>
                    <td>
                      {m.status === "active" ? (
                        <select value={m.role} onChange={(e) => runAction(m.memberId, { action: "changeRole", role: e.target.value })}>
                          {ROLE_ORDER.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                          {m.role === "Not Configured" && <option value="Not Configured">Not Configured</option>}
                        </select>
                      ) : m.role === "Not Configured" ? (
                        <span className="muted">Not Configured</span>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </td>
                    <td>
                      {m.status === "active" ? (
                        <select value={m.teamId} onChange={(e) => runAction(m.memberId, { action: "move", teamId: e.target.value })}>
                          {teams.map((t) => (
                            <option key={t.teamId} value={t.teamId}>
                              {t.teamName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        m.teamName
                      )}
                    </td>
                    <td>{m.hubspotOwnerId ?? <span className="muted">Not mapped</span>}</td>
                    <td>
                      <span className={`badge${m.status === "deactivated" ? "" : ""}`} style={m.status === "deactivated" ? { color: "var(--color-error)" } : undefined}>
                        {m.status}
                      </span>
                    </td>
                    <td>
                      <div className="filter-bar" style={{ gap: "0.4rem" }}>
                        {m.status === "active" && (
                          <button className="link-button" onClick={() => runAction(m.memberId, { action: "deactivate" })}>
                            Deactivate
                          </button>
                        )}
                        {m.status === "deactivated" && (
                          <button className="link-button" onClick={() => runAction(m.memberId, { action: "reactivate" })}>
                            Reactivate
                          </button>
                        )}
                        <button className="link-button" onClick={() => setRemoveTarget(m)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.members.length && (
            <div className="pagination">
              <span className="muted">
                Showing {data.members.length.toLocaleString()} of {data.total.toLocaleString()}
              </span>
              <button onClick={() => setLimit((l) => l + LOAD_MORE_STEP)}>View More ({Math.min(LOAD_MORE_STEP, data.total - data.members.length)})</button>
            </div>
          )}
        </div>
      )}

      {removeTarget && (
        <RemoveMemberDrawer
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={async () => {
            await runAction(removeTarget.memberId, { action: "remove" });
            setRemoveTarget(null);
          }}
        />
      )}
    </div>
  );
}

function RemoveMemberDrawer({ member, onClose, onConfirm }: { member: MemberRow; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  return (
    <Drawer open title="Remove Member" onClose={onClose}>
      <div style={{ padding: "0 0.6rem" }}>
        <p className="muted">Remove {member.name} from the dashboard?</p>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          This will remove the member from the dashboard team configuration. It will not delete the HubSpot user or modify any
          HubSpot records. Historical assignment/report references to this member are preserved.
        </p>
        <div className="filter-bar" style={{ marginTop: "1rem" }}>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {busy ? "Removing…" : "Remove from Dashboard"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  );
}
