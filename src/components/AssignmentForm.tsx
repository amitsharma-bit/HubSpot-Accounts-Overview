"use client";

import { useState } from "react";
import { ROLE_ORDER, UNASSIGNED_POD } from "@/config/roster";
import type { Person } from "@/app/api/roster/people/route";

export function AssignmentForm({
  people,
  pods,
  editingPerson,
  onSaved,
}: {
  people: Person[];
  pods: string[];
  editingPerson: Person | null;
  onSaved: () => void;
}) {
  const [ownerId, setOwnerId] = useState("");
  const [role, setRole] = useState<string>(ROLE_ORDER[0]);
  const [pod, setPod] = useState<string>(UNASSIGNED_POD);
  const [newPod, setNewPod] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the row clicked in PeopleTable, adjusted during render (not
  // an effect) per React's "adjusting state when a prop changes" pattern.
  const [prefilledFor, setPrefilledFor] = useState<Person | null>(null);
  if (editingPerson && editingPerson !== prefilledFor) {
    setPrefilledFor(editingPerson);
    setOwnerId(String(editingPerson.ownerId));
    setRole(editingPerson.role ?? ROLE_ORDER[0]);
    setPod(editingPerson.pod);
    setNewPod("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const person = people.find((p) => String(p.ownerId) === ownerId);
    if (!person) {
      setError("Pick a HubSpot owner first.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: person.ownerId, name: person.name, role, pod: newPod.trim() || pod }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setSavedMessage(`Saved ${person.name}.`);
      setNewPod("");
      onSaved();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="section-title">Add / Update assignment</div>
      <div className="filter-bar" style={{ marginTop: "0.75rem", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: "1 1 220px" }}>
          <label className="muted">Person</label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
            <option value="">Select a HubSpot owner…</option>
            {people.map((p) => (
              <option key={p.ownerId} value={p.ownerId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label className="muted">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label className="muted">Pod</label>
          <select value={pod} onChange={(e) => setPod(e.target.value)}>
            {pods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <label className="muted">Or create a new pod (overrides the dropdown above)</label>
        <div className="filter-bar" style={{ marginTop: "0.3rem" }}>
          <input placeholder="New pod name" value={newPod} onChange={(e) => setNewPod(e.target.value)} />
          <button className="pill selected" type="submit" disabled={saving} style={{ cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Saving…" : "Add / Update"}
          </button>
        </div>
      </div>

      {error && <p className="muted" style={{ color: "#EF4444", marginTop: "0.5rem" }}>{error}</p>}
      {savedMessage && !error && <p className="muted" style={{ color: "#10B981", marginTop: "0.5rem" }}>{savedMessage}</p>}
    </form>
  );
}
