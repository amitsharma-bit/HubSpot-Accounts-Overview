"use client";

import { useMemo, useState } from "react";
import { useJson } from "@/lib/useJson";
import { fmt, fmtDate } from "@/lib/format";
import { Drawer, DrawerSection, DrawerField } from "./Drawer";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import type { GroupDetail, GroupCompanyRow } from "@/lib/types";

type SortKey = "name" | "ownerName" | "ownerAssignedDate" | "lastActivityDate" | "potentialRooftops";

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th className={`sortable${sortKey === k ? " sort-active" : ""}`} onClick={() => onSort(k)}>
      {label}
      <span className="sort-indicator">
        <Icon name={sortKey === k ? (sortDir === 1 ? "chevronUp" : "chevronDown") : "chevronsUpDown"} size={13} />
      </span>
    </th>
  );
}

export function GroupDetailDrawer({ gdId, onClose }: { gdId: string; onClose: () => void }) {
  const { data, loading, error } = useJson<GroupDetail>(`/api/group/${gdId}`);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? data.companies.filter((c) => c.name?.toLowerCase().includes(term) || c.domain?.toLowerCase().includes(term))
      : data.companies;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" || typeof bv === "number") return (((av as number) ?? 0) - ((bv as number) ?? 0)) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
  }, [data, q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return (
    <Drawer open title={data?.gdName ?? "Dealership Group"} subtitle="Group details" onClose={onClose}>
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load group: {error}</div>}
      {data && (
        <>
          <DrawerSection title="Group Overview">
            <DrawerField label="Dealership Group Name" value={fmt(data.gdName)} />
            <DrawerField label="GD ID" value={data.gdId} />
            <DrawerField label="GD Stage" value={fmt(data.gdStage)} />
            <DrawerField label="GD Last Activity" value={fmtDate(data.gdLastActivityDate)} />
            <DrawerField label="Total Contacts" value={data.totalContacts.toLocaleString()} />
            <DrawerField label="Total Companies" value={data.totalCompanies.toLocaleString()} />
            <DrawerField label="Total Potential Rooftops" value={data.totalPotentialRooftops.toLocaleString()} />
          </DrawerSection>

          <div className="drawer-section">
            <div className="drawer-section-title">Companies in this Group</div>
            <label className="search-box-compact" style={{ width: "100%" }}>
              <Icon name="search" size={14} />
              <input placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="table-card" style={{ boxShadow: "none" }}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <Th label="Company" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <Th label="Owner" k="ownerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <Th
                        label="Owner Assigned"
                        k="ownerAssignedDate"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      <Th
                        label="Last Activity"
                        k="lastActivityDate"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      <Th
                        label="Potential Rooftops"
                        k="potentialRooftops"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c: GroupCompanyRow) => (
                      <tr key={c.id}>
                        <td>{fmt(c.name)}</td>
                        <td>
                          {c.ownerName ? (
                            <span className="person">
                              <Avatar name={c.ownerName} size={20} />
                              {c.ownerName}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{fmtDate(c.ownerAssignedDate)}</td>
                        <td>{fmtDate(c.lastActivityDate)}</td>
                        <td>{c.potentialRooftops ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
