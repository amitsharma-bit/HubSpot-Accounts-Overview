"use client";

import { useMemo, useState } from "react";
import { useJson } from "@/lib/useJson";
import { Drawer, DrawerSection, DrawerField } from "@/components/Drawer";
import { ROLE_ORDER } from "@/config/roster";
import type { DashboardTeam } from "@/lib/rosterStore";
import type { Person } from "@/app/api/roster/people/route";

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json;
}

/**
 * Compact team-management action bar (Phase 16) — replaces the old
 * permanently-visible "Add/Update assignment" form. Add Team / Add Member
 * expand into a small drawer instead of occupying page space by default.
 */
export function TeamManagementBar({ teams, onChanged }: { teams: DashboardTeam[]; onChanged: () => void }) {
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  return (
    <div className="filter-bar">
      <button className="btn btn-secondary" onClick={() => setAddTeamOpen(true)}>
        + Add Team
      </button>
      <button className="btn btn-secondary" onClick={() => setAddMemberOpen(true)}>
        + Add Member
      </button>

      <AddTeamDrawer open={addTeamOpen} onClose={() => setAddTeamOpen(false)} onSaved={onChanged} />
      <AddMemberDrawer open={addMemberOpen} onClose={() => setAddMemberOpen(false)} onSaved={onChanged} teams={teams} />
    </div>
  );
}

function AddTeamDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/roster/teams", { teamName });
      setTeamName("");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="Add Team" onClose={onClose}>
      <div style={{ padding: "0 0.6rem" }}>
        <label className="filter-field">
          <span>Team Name</span>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. New York Team" />
        </label>
        {error && (
          <p className="muted" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>
            {error}
          </p>
        )}
        <div className="filter-bar" style={{ marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || !teamName.trim()}>
            {saving ? "Creating…" : "Create Team"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function AddMemberDrawer({
  open,
  onClose,
  onSaved,
  teams,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  teams: DashboardTeam[];
}) {
  const [search, setSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [role, setRole] = useState<string>(ROLE_ORDER[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useJson<{ people: Person[] }>(open ? "/api/roster/people" : null);
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const people = data?.people ?? [];
    const filtered = term ? people.filter((p) => p.name.toLowerCase().includes(term) || (p.email ?? "").toLowerCase().includes(term)) : people;
    return filtered.slice(0, 25);
  }, [data, search]);

  const selectedPerson = data?.people.find((p) => p.ownerId === selectedOwnerId) ?? null;

  async function save() {
    if (!selectedPerson) return;
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/roster/members", { name: selectedPerson.name, email: selectedPerson.email, hubspotOwnerId: selectedPerson.ownerId, teamId, role });
      setSelectedOwnerId(null);
      setSearch("");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="Add Member" subtitle="Search HubSpot users to add to the dashboard" onClose={onClose}>
      <div style={{ padding: "0 0.6rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label className="search-box-compact" style={{ width: "100%" }}>
          <input placeholder="Search HubSpot users…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>

        <div className="drawer-fields" style={{ maxHeight: 260, overflowY: "auto" }}>
          {results.map((p) => (
            <button
              key={p.ownerId}
              className="column-row"
              style={{ width: "100%", justifyContent: "space-between", background: selectedOwnerId === p.ownerId ? "var(--accent-soft)" : undefined }}
              onClick={() => setSelectedOwnerId(p.ownerId)}
            >
              <span>
                {p.name} <span className="muted">{p.email ?? ""}</span>
              </span>
              {p.onDashboard ? (
                <span className="badge">
                  already on dashboard{p.teamName ? ` — ${p.teamName}` : ""} ({p.status})
                </span>
              ) : (
                <span className="muted">not on dashboard</span>
              )}
            </button>
          ))}
          {results.length === 0 && <div className="muted" style={{ padding: "0.5rem" }}>No matching HubSpot users.</div>}
        </div>

        {selectedPerson && (
          <>
            <DrawerSection title="Add to Dashboard">
              <DrawerField label="Selected" value={`${selectedPerson.name} (Owner ID ${selectedPerson.ownerId})`} />
            </DrawerSection>
            <label className="filter-field">
              <span>Team</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {error && (
          <p className="muted" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}

        <div className="filter-bar">
          <button className="btn btn-primary" onClick={save} disabled={!selectedPerson || selectedPerson.onDashboard || saving || !teamId}>
            {saving ? "Adding…" : "Add to Dashboard"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  );
}
