"use client";

import { useState } from "react";
import { Drawer } from "@/components/Drawer";
import type { DashboardTeam, DashboardMember } from "@/lib/rosterStore";

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json;
}

export function TeamsSummary({ teams, members, onChanged }: { teams: DashboardTeam[]; members: DashboardMember[]; onChanged: () => void }) {
  const [renameTarget, setRenameTarget] = useState<DashboardTeam | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DashboardTeam | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCountByTeam = new Map<string, number>();
  for (const m of members) {
    if (m.status === "active") activeCountByTeam.set(m.teamId, (activeCountByTeam.get(m.teamId) ?? 0) + 1);
  }

  async function reactivate(teamId: string) {
    setError(null);
    try {
      await patchJson("/api/roster/teams", { teamId, action: "reactivate" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate team.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Teams</div>
      {error && (
        <p className="muted" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      <div className="drawer-fields">
        {teams.map((t) => (
          <div key={t.teamId} className="drawer-field">
            <span className="drawer-field-label">
              {t.teamName}
              {t.status === "archived" && <span className="badge" style={{ marginLeft: "0.4rem" }}>archived</span>}
            </span>
            <span className="drawer-field-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {activeCountByTeam.get(t.teamId) ?? 0} members
              <button className="link-button" onClick={() => setRenameTarget(t)}>
                Rename
              </button>
              {t.status === "active" ? (
                <button className="link-button" onClick={() => setArchiveTarget(t)}>
                  Archive
                </button>
              ) : (
                <button className="link-button" onClick={() => reactivate(t.teamId)}>
                  Reactivate
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {renameTarget && (
        <RenameTeamDrawer team={renameTarget} onClose={() => setRenameTarget(null)} onSaved={onChanged} />
      )}
      {archiveTarget && (
        <ArchiveTeamDrawer
          team={archiveTarget}
          activeMemberCount={activeCountByTeam.get(archiveTarget.teamId) ?? 0}
          otherTeams={teams.filter((t) => t.teamId !== archiveTarget.teamId && t.status === "active")}
          onClose={() => setArchiveTarget(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function RenameTeamDrawer({ team, onClose, onSaved }: { team: DashboardTeam; onClose: () => void; onSaved: () => void }) {
  const [teamName, setTeamName] = useState(team.teamName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await patchJson("/api/roster/teams", { teamId: team.teamId, action: "update", teamName });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open title="Rename Team" onClose={onClose}>
      <div style={{ padding: "0 0.6rem" }}>
        <label className="filter-field">
          <span>Team Name</span>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        </label>
        {error && (
          <p className="muted" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>
            {error}
          </p>
        )}
        <div className="filter-bar" style={{ marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || !teamName.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  );
}

/** Never allows a silent delete — either move members first, or explicitly archive-anyway. */
function ArchiveTeamDrawer({
  team,
  activeMemberCount,
  otherTeams,
  onClose,
  onChanged,
}: {
  team: DashboardTeam;
  activeMemberCount: number;
  otherTeams: DashboardTeam[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [moveToTeamId, setMoveToTeamId] = useState(otherTeams[0]?.teamId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function moveThenArchive() {
    setBusy(true);
    setError(null);
    try {
      if (moveToTeamId) await patchJson("/api/roster/teams", { teamId: team.teamId, action: "moveMembers", toTeamId: moveToTeamId });
      await patchJson("/api/roster/teams", { teamId: team.teamId, action: "archive" });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive team.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveAnyway() {
    setBusy(true);
    setError(null);
    try {
      await patchJson("/api/roster/teams", { teamId: team.teamId, action: "archive", force: true });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open title="Archive Team" onClose={onClose}>
      <div style={{ padding: "0 0.6rem" }}>
        {activeMemberCount > 0 ? (
          <>
            <p className="muted">
              {team.teamName} currently has {activeMemberCount} active member{activeMemberCount === 1 ? "" : "s"}. Move them to
              another team, or archive anyway (members keep their teamId and become invisible in active views until moved).
            </p>
            {otherTeams.length > 0 && (
              <label className="filter-field" style={{ marginTop: "0.75rem" }}>
                <span>Move members to</span>
                <select value={moveToTeamId} onChange={(e) => setMoveToTeamId(e.target.value)}>
                  {otherTeams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p className="muted" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>
                {error}
              </p>
            )}
            <div className="filter-bar" style={{ marginTop: "1rem" }}>
              {otherTeams.length > 0 && (
                <button className="btn btn-primary" onClick={moveThenArchive} disabled={busy}>
                  Move Members &amp; Archive
                </button>
              )}
              <button className="btn btn-secondary" onClick={archiveAnyway} disabled={busy}>
                Archive Anyway
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Archive {team.teamName}? It has no active members.</p>
            {error && (
              <p className="muted" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}
            <div className="filter-bar" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" onClick={archiveAnyway} disabled={busy}>
                Archive
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
