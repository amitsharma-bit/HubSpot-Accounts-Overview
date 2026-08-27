"use client";

import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./Badge";
import type { Person } from "@/app/api/roster/people/route";

type SortKey = "name" | "email" | "role" | "pod" | "source";

function SortHeader({
  label,
  sortableKey,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortableKey: SortKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th style={{ cursor: "pointer" }} onClick={() => onSort(sortableKey)}>
      {label} {sortKey === sortableKey ? (sortDir === 1 ? "▲" : "▼") : "⇕"}
    </th>
  );
}

export function PeopleTable({ people, onEdit }: { people: Person[]; onEdit: (person: Person) => void }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = term
      ? people.filter((p) => p.name.toLowerCase().includes(term) || (p.email ?? "").toLowerCase().includes(term))
      : people;
    return [...rows].sort((a, b) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      return av.localeCompare(bv) * sortDir;
    });
  }, [people, q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return (
    <div className="section">
      <div className="filter-bar">
        <label className="search-box" style={{ maxWidth: 320 }}>
          <Icon name="search" size={16} />
          <input placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="muted">{filtered.length.toLocaleString()} people</span>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortHeader label="Name" sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Email" sortableKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Role" sortableKey="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Pod" sortableKey="pod" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Source" sortableKey="source" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.ownerId}>
                  <td>
                    <span className="person">
                      <Avatar name={p.name} size={26} />
                      {p.name}
                      {p.isMerged && <span className="chip">merged</span>}
                    </span>
                  </td>
                  <td>{p.email ?? "—"}</td>
                  <td>{p.role ? <RoleBadge role={p.role} /> : <span className="muted">—</span>}</td>
                  <td>{p.pod}</td>
                  <td>{p.source ?? "—"}</td>
                  <td>
                    <button
                      onClick={() => onEdit(p)}
                      style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
