"use client";

import { useMemo, useState } from "react";
import { useJson } from "@/lib/useJson";
import { GROUP_FIELDS, COMPANY_FIELDS, ROOFTOP_AGGREGATION_FIELDS, OPERATORS_BY_TYPE, type FieldDef } from "@/lib/assignment/fieldDefs";
import { Drawer, DrawerSection, DrawerField } from "@/components/Drawer";
import type {
  AssignmentType,
  DealershipGroup,
  Company,
  FilterDefinition,
  FilterGroup,
  FilterFieldType,
  RooftopAggregation,
  QualificationResult,
  AssignmentPreview as AssignmentPreviewT,
  SalesMember,
  SavedView,
} from "@/lib/assignment/types";

// ---------------------------------------------------------------------------
// Local, plain, functional filter-row UI state (Phase 44/51: no fancy builder
// UI needed — a flat AND-list of rows is exactly what the spec's own mockup
// shows). Combined into one AND FilterGroup before being sent to the API.
// ---------------------------------------------------------------------------

type FilterRow = {
  id: string;
  isRooftop: boolean; // Group assignment type only — toggles GROUP vs AGGREGATED_ROOFTOPS scope
  field: string;
  fieldType: FilterFieldType;
  operator: string;
  value: string;
  secondValue: string;
  aggregation: RooftopAggregation;
  aggregationCount: string;
};

function newRow(fieldDef: FieldDef, isRooftop: boolean): FilterRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    isRooftop,
    field: fieldDef.field,
    fieldType: fieldDef.type,
    operator: OPERATORS_BY_TYPE[fieldDef.type][0].value,
    value: "",
    secondValue: "",
    aggregation: "ALL",
    aggregationCount: "1",
  };
}

// `scope` is set by buildFilterGroup (below), not here — it depends on the
// assignment type (GROUP vs COMPANY), which this function doesn't know about.
function rowToFilterDefinition(row: FilterRow): Omit<FilterDefinition, "scope"> {
  const base: Omit<FilterDefinition, "scope"> = {
    field: row.field,
    fieldType: row.fieldType,
    operator: row.operator as FilterDefinition["operator"],
  };
  if (row.fieldType === "NUMBER") {
    base.value = row.value === "" ? undefined : Number(row.value);
    if (row.operator === "between" || row.operator === "notBetween") base.secondValue = row.secondValue === "" ? undefined : Number(row.secondValue);
  } else if (row.fieldType === "DATE") {
    base.value = row.operator === "withinLast" || row.operator === "withinNext" || row.operator === "olderThan" || row.operator === "newerThan" ? Number(row.value) : row.value;
    if (row.operator === "between") base.secondValue = row.secondValue;
  } else if (row.operator === "isAnyOf" || row.operator === "isNoneOf") {
    base.values = row.value.split(",").map((v) => v.trim()).filter(Boolean);
  } else {
    base.value = row.value;
  }
  if (row.isRooftop) {
    base.aggregation = row.aggregation;
    if (row.aggregation === "AT_LEAST" || row.aggregation === "AT_MOST" || row.aggregation === "EXACTLY") {
      base.aggregationCount = Number(row.aggregationCount) || 0;
    }
  }
  return base;
}

function buildFilterGroup(rows: FilterRow[], companyScope: boolean): FilterGroup | null {
  if (rows.length === 0) return null;
  return {
    kind: "node",
    operator: "AND",
    children: rows.map((r) => ({
      kind: "leaf",
      filter: { ...rowToFilterDefinition(r), scope: r.isRooftop ? "AGGREGATED_ROOFTOPS" : companyScope ? "COMPANY" : "GROUP" },
    })),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: "DEALERSHIP_GROUP", label: "Dealership Groups" },
  { value: "SINGLE_FRANCHISE", label: "Single Franchise" },
  { value: "INDEPENDENT_ROOFTOP", label: "Independent Rooftops" },
];

export function DataAssignmentClient() {
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("DEALERSHIP_GROUP");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [requireUsQualified, setRequireUsQualified] = useState(true);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetOwnerKey, setTargetOwnerKey] = useState("");
  const [previewResult, setPreviewResult] = useState<AssignmentPreviewT | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [savedViewName, setSavedViewName] = useState("");

  const isGroupMode = assignmentType === "DEALERSHIP_GROUP";
  const dealershipClass = assignmentType === "SINGLE_FRANCHISE" ? "Franchise" : "Independent";
  const fieldOptions = isGroupMode ? GROUP_FIELDS : COMPANY_FIELDS;

  function resetForTypeChange(next: AssignmentType) {
    setAssignmentType(next);
    setRows([]);
    setSearch("");
    setSelectedIds(new Set());
    setPage(1);
    setSortField(null);
  }

  const filterGroupAst = useMemo(() => buildFilterGroup(rows, !isGroupMode), [rows, isGroupMode]);

  const groupsUrl = isGroupMode
    ? `/api/data-assignment/groups?${new URLSearchParams({
        q: search,
        usOnly: String(requireUsQualified),
        page: String(page),
        pageSize: String(pageSize),
        ...(sortField ? { sortField, sortDir } : {}),
        ...(filterGroupAst ? { filters: JSON.stringify(filterGroupAst) } : {}),
      }).toString()}`
    : null;
  const companiesUrl = !isGroupMode
    ? `/api/data-assignment/companies?${new URLSearchParams({
        dealershipClass,
        q: search,
        page: String(page),
        pageSize: String(pageSize),
        ...(sortField ? { sortField, sortDir } : {}),
        ...(filterGroupAst ? { filters: JSON.stringify(filterGroupAst) } : {}),
      }).toString()}`
    : null;

  const { data: groupData, loading: groupLoading, error: groupError } = useJson<{
    total: number;
    groups: (DealershipGroup & { qualification: QualificationResult })[];
    totalEligible: number;
    totalExcluded: number;
  }>(groupsUrl);
  const { data: companyData, loading: companyLoading, error: companyError } = useJson<{ total: number; companies: Company[] }>(companiesUrl);
  const { data: membersData } = useJson<{ members: SalesMember[] }>("/api/data-assignment/members");
  const { data: savedViewsData } = useJson<{ views: SavedView[]; presets: { name: string; assignmentType: AssignmentType; filters: FilterGroup }[] }>(
    "/api/data-assignment/saved-views"
  );

  const loading = isGroupMode ? groupLoading : companyLoading;
  const error = isGroupMode ? groupError : companyError;
  const total = isGroupMode ? groupData?.total ?? 0 : companyData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function addFilterRow() {
    setRows((r) => [...r, newRow(fieldOptions[0], false)]);
    setPage(1);
  }
  function addRooftopFilterRow() {
    setRows((r) => [...r, newRow(ROOFTOP_AGGREGATION_FIELDS[0], true)]);
    setPage(1);
  }
  function updateRow(id: string, patch: Partial<FilterRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }
  function applyFilters() {
    setPage(1);
  }
  function resetFilters() {
    setRows([]);
    setSearch("");
    setRequireUsQualified(true);
    setPage(1);
  }

  function toggleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const target = useMemo(() => {
    const m = membersData?.members.find((x) => x.ownerIds.join(",") === targetOwnerKey);
    if (!m) return null;
    return { ownerId: m.ownerIds[0], name: m.name, role: m.role, team: m.team };
  }, [membersData, targetOwnerKey]);

  async function runPreview(record: boolean) {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const selection = isGroupMode
        ? { assignmentType, selectedGroupIds: Array.from(selectedIds), selectedCompanyIds: [] }
        : { assignmentType, selectedGroupIds: [], selectedCompanyIds: Array.from(selectedIds) };
      const result = await postJson<AssignmentPreviewT>("/api/data-assignment/preview", { selection, target, record });
      setPreviewResult(result);
    } catch {
      setPreviewError("Failed to compute assignment preview. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveCurrentView() {
    if (!savedViewName.trim() || !filterGroupAst) return;
    await postJson("/api/data-assignment/saved-views", {
      name: savedViewName.trim(),
      assignmentType,
      filters: filterGroupAst,
      search,
      sort: sortField ? { field: sortField, direction: sortDir } : null,
      visibleColumns: [],
      createdBy: "current-user",
    });
    setSavedViewName("");
  }

  function loadSavedView(view: SavedView) {
    setAssignmentType(view.assignmentType);
    setSearch(view.search);
    setSortField(view.sort?.field ?? null);
    setSortDir(view.sort?.direction ?? "asc");
    setPage(1);
    // Filters from a saved view are re-applied as the AST directly (rows stay
    // empty) — good enough for a prototype; round-tripping the AST back into
    // editable rows is a later UI nicety, not a logic requirement.
    setRows([]);
  }

  return (
    <div className="section">
      <div className="filter-bar">
        {ASSIGNMENT_TYPES.map((t) => (
          <button key={t.value} className={`tab-btn${assignmentType === t.value ? " active" : ""}`} onClick={() => resetForTypeChange(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="filter-bar">
          <label className="search-box-compact" style={{ width: 260 }}>
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {isGroupMode && (
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input type="checkbox" checked={requireUsQualified} onChange={(e) => setRequireUsQualified(e.target.checked)} />
              US-qualified only (ALL associated rooftops must be US)
            </label>
          )}
        </div>

        <div className="filter-bar" style={{ flexWrap: "wrap" }}>
          {rows.map((row) => {
            const options = row.isRooftop ? ROOFTOP_AGGREGATION_FIELDS : fieldOptions;
            const def = options.find((f) => f.field === row.field) ?? options[0];
            return (
              <span key={row.id} className="chip" style={{ background: "var(--bg)", color: "var(--text)", flexWrap: "wrap" }}>
                {row.isRooftop && (
                  <select
                    value={row.aggregation}
                    onChange={(e) => updateRow(row.id, { aggregation: e.target.value as RooftopAggregation })}
                  >
                    {(["ANY", "ALL", "NONE", "AT_LEAST", "AT_MOST", "EXACTLY"] as RooftopAggregation[]).map((a) => (
                      <option key={a} value={a}>
                        {a === "ANY" ? "Any rooftop" : a === "ALL" ? "All rooftops" : a === "NONE" ? "No rooftops" : `${a.replace("_", " ")} rooftops`}
                      </option>
                    ))}
                  </select>
                )}
                {row.isRooftop && (row.aggregation === "AT_LEAST" || row.aggregation === "AT_MOST" || row.aggregation === "EXACTLY") && (
                  <input
                    type="number"
                    style={{ width: 44 }}
                    value={row.aggregationCount}
                    onChange={(e) => updateRow(row.id, { aggregationCount: e.target.value })}
                  />
                )}
                <select
                  value={row.field}
                  onChange={(e) => {
                    const nd = options.find((f) => f.field === e.target.value)!;
                    updateRow(row.id, { field: nd.field, fieldType: nd.type, operator: OPERATORS_BY_TYPE[nd.type][0].value });
                  }}
                >
                  {options.map((f) => (
                    <option key={f.field} value={f.field}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select value={row.operator} onChange={(e) => updateRow(row.id, { operator: e.target.value })}>
                  {OPERATORS_BY_TYPE[def.type].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {row.operator !== "isKnown" && row.operator !== "isUnknown" && (
                  <input
                    style={{ width: 110 }}
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    placeholder={row.operator === "isAnyOf" || row.operator === "isNoneOf" ? "a, b, c" : "value"}
                  />
                )}
                {(row.operator === "between" || row.operator === "notBetween") && (
                  <input style={{ width: 90 }} value={row.secondValue} onChange={(e) => updateRow(row.id, { secondValue: e.target.value })} placeholder="to" />
                )}
                <button onClick={() => removeRow(row.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>
                  &times;
                </button>
              </span>
            );
          })}
          <button className="btn btn-secondary" onClick={addFilterRow}>
            + Add Filter
          </button>
          {isGroupMode && (
            <button className="btn btn-secondary" onClick={addRooftopFilterRow}>
              + Add Rooftop Condition
            </button>
          )}
          <button className="btn btn-primary" onClick={applyFilters}>
            Apply
          </button>
          <button className="btn btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="filter-bar">
          <input placeholder="Save current view as…" value={savedViewName} onChange={(e) => setSavedViewName(e.target.value)} style={{ width: 200 }} />
          <button className="btn btn-secondary" onClick={saveCurrentView} disabled={!savedViewName.trim()}>
            Save View
          </button>
          {(savedViewsData?.presets ?? []).map((p) => (
            <button
              key={p.name}
              className="pill"
              onClick={() =>
                loadSavedView({ ...p, id: p.name, createdBy: "", createdAt: "", updatedAt: "", visibleColumns: [], search: "", sort: null })
              }
            >
              {p.name}
            </button>
          ))}
          {(savedViewsData?.views ?? []).map((v) => (
            <button key={v.id} className="pill" onClick={() => loadSavedView(v)}>
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar" style={{ justifyContent: "space-between" }}>
        <span className="muted">
          {isGroupMode ? (
            <>
              {total.toLocaleString()} matching groups
              {groupData && ` — ${groupData.totalEligible.toLocaleString()} US-qualified, ${groupData.totalExcluded.toLocaleString()} excluded`}
            </>
          ) : (
            <>{total.toLocaleString()} matching companies</>
          )}
        </span>
        <span className="muted">{selectedIds.size} selected</span>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load: {error}</div>}

      {!loading && !error && isGroupMode && groupData && (
        <GroupTable
          groups={groupData.groups}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onOpen={setOpenGroupId}
          sortField={sortField}
          sortDir={sortDir}
          onSort={toggleSort}
        />
      )}
      {!loading && !error && !isGroupMode && companyData && (
        <CompanyTable
          companies={companyData.companies}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onOpen={setOpenCompanyId}
          sortField={sortField}
          sortDir={sortDir}
          onSort={toggleSort}
        />
      )}

      <div className="pagination">
        <span className="muted">
          Page {page} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Assignment Preview</div>
        <div className="filter-bar">
          <select value={targetOwnerKey} onChange={(e) => setTargetOwnerKey(e.target.value)}>
            <option value="">Select a target sales member…</option>
            {(membersData?.members ?? []).map((m) => (
              <option key={m.ownerIds.join(",")} value={m.ownerIds.join(",")}>
                {m.name} — {m.role} — {m.team}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => runPreview(false)} disabled={selectedIds.size === 0 || previewLoading}>
            {previewLoading ? "Computing…" : "Preview Assignment"}
          </button>
        </div>
        {previewError && <div className="muted">{previewError}</div>}
        {previewResult && <PreviewSummary preview={previewResult} onRecord={() => runPreview(true)} />}
      </div>

      {openGroupId && <GroupDetailPanel id={openGroupId} onClose={() => setOpenGroupId(null)} />}
      {openCompanyId && <CompanyDetailPanel id={openCompanyId} onClose={() => setOpenCompanyId(null)} />}
    </div>
  );
}

function SortHeader({ label, field, sortField, sortDir, onSort }: { label: string; field: string; sortField: string | null; sortDir: "asc" | "desc"; onSort: (f: string) => void }) {
  return (
    <th className={`sortable${sortField === field ? " sort-active" : ""}`} onClick={() => onSort(field)}>
      {label} {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "⇕"}
    </th>
  );
}

function GroupTable({
  groups,
  selectedIds,
  onToggle,
  onOpen,
  sortField,
  sortDir,
  onSort,
}: {
  groups: (DealershipGroup & { qualification: QualificationResult })[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <SortHeader label="Group Name" field="groupName" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Rooftops" field="actualRooftops" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="GD Stage" field="gdStage" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th>Owner</th>
              <SortHeader label="Used Cars" field="usedCars" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Last Activity" field="gdLastActivity" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th>US Qualified</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => onToggle(g.id)} />
                </td>
                <td>
                  <button className="link-button" onClick={() => onOpen(g.id)}>
                    {g.groupName ?? g.id}
                  </button>
                </td>
                <td>{g.actualRooftops ?? "—"}</td>
                <td>{g.gdStage ?? "—"}</td>
                <td>{g.owner ?? "—"}</td>
                <td>{g.usedCars ?? "—"}</td>
                <td>{g.gdLastActivity ? new Date(g.gdLastActivity).toLocaleDateString() : "—"}</td>
                <td>{g.qualification.eligible ? "✓" : `✕ ${g.qualification.reasons.join(", ")}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyTable({
  companies,
  selectedIds,
  onToggle,
  onOpen,
  sortField,
  sortDir,
  onSort,
}: {
  companies: Company[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <SortHeader label="Company" field="companyName" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th>Domain</th>
              <SortHeader label="City" field="city" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="State" field="state" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th>Owner</th>
              <SortHeader label="Used Cars" field="usedCars" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th>Assignment Status</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => onToggle(c.id)} />
                </td>
                <td>
                  <button className="link-button" onClick={() => onOpen(c.id)}>
                    {c.companyName ?? c.id}
                  </button>
                </td>
                <td>{c.domain ?? "—"}</td>
                <td>{c.city ?? "—"}</td>
                <td>{c.state ?? "—"}</td>
                <td>{c.companyOwner ?? "—"}</td>
                <td>{c.usedCars ?? "—"}</td>
                <td>{c.assignmentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewSummary({ preview, onRecord }: { preview: AssignmentPreviewT; onRecord: () => void }) {
  return (
    <div className="drawer-fields" style={{ marginTop: "0.75rem" }}>
      <DrawerField label="Status" value={preview.status} />
      <DrawerField label="Target" value={`${preview.target.name} (${preview.target.role}, ${preview.target.team})`} />
      <DrawerField label="Selected Groups" value={preview.selectedGroupCount} />
      <DrawerField label="Selected Companies" value={preview.selectedCompanyCount} />
      <DrawerField label="Affected Companies" value={preview.affectedCompanyCount} />
      <DrawerField label="Eligible" value={preview.eligibleCount} />
      <DrawerField label="Excluded" value={preview.excludedCount} />
      <DrawerField
        label="Current Ownership"
        value={preview.currentOwnership.map((o) => `${o.ownerName}: ${o.count}`).join(", ") || "—"}
      />
      <DrawerField
        label="Conflicts"
        value={
          preview.conflicts.length === 0
            ? "None"
            : preview.conflicts.map((c) => `[${c.severity}] ${c.message}`).join(" | ")
        }
      />
      <DrawerField
        label=""
        value={
          <button className="btn btn-secondary" onClick={onRecord}>
            Record this simulation to history
          </button>
        }
      />
    </div>
  );
}

function GroupDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error } = useJson<{ group: DealershipGroup; companies: Company[] }>(`/api/data-assignment/group/${id}`);
  return (
    <Drawer open title={data?.group.groupName ?? "Dealership Group"} subtitle="Group details" onClose={onClose}>
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load group: {error}</div>}
      {data && (
        <>
          <DrawerSection title="Group Overview">
            <DrawerField label="Group Name" value={data.group.groupName ?? "—"} />
            <DrawerField label="Record ID" value={data.group.id} />
            <DrawerField label="Owner" value={data.group.owner ?? "—"} />
            <DrawerField label="Owner Team" value={data.group.ownerTeam ?? "—"} />
            <DrawerField label="GD Stage" value={data.group.gdStage ?? "—"} />
            <DrawerField label="Dealership Rank" value={data.group.dealershipRank ?? "—"} />
            <DrawerField label="Actual Rooftops" value={data.group.actualRooftops ?? "—"} />
            <DrawerField label="GD Last Activity" value={data.group.gdLastActivity ? new Date(data.group.gdLastActivity).toLocaleString() : "—"} />
            <DrawerField label="Used / New / Total Cars" value={`${data.group.usedCars ?? "—"} / ${data.group.newCars ?? "—"} / ${data.group.totalCars ?? "—"}`} />
          </DrawerSection>
          <DrawerSection title={`Associated Companies (${data.companies.length})`}>
            {data.companies.map((c) => (
              <DrawerField key={c.id} label={c.companyName ?? c.id} value={`${c.country ?? "—"} — ${c.companyOwner ?? "Unowned"}`} />
            ))}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

function CompanyDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error } = useJson<Company>(`/api/data-assignment/company/${id}`);
  return (
    <Drawer open title={data?.companyName ?? "Company"} subtitle="Company details" onClose={onClose}>
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load company: {error}</div>}
      {data && (
        <DrawerSection title="Company">
          <DrawerField label="Company Name" value={data.companyName ?? "—"} />
          <DrawerField label="Domain" value={data.domain ?? "—"} />
          <DrawerField label="GD Name" value={data.gdName ?? "—"} />
          <DrawerField label="Owner" value={data.companyOwner ?? "—"} />
          <DrawerField label="Assignment Status" value={data.assignmentStatus} />
          <DrawerField label="Classification" value={`${data.classification.pool} — ${data.classification.reason}`} />
          <DrawerField label="Used / New / Total Cars" value={`${data.usedCars ?? "—"} / ${data.newCars ?? "—"} / ${data.totalCars ?? "—"}`} />
          <DrawerField label="Market Segment" value={data.marketSegment ?? "—"} />
          <DrawerField label="Website Status" value={data.websiteStatus ?? "—"} />
          <DrawerField label="Last Activity" value={data.lastActivityDate ? new Date(data.lastActivityDate).toLocaleString() : "—"} />
        </DrawerSection>
      )}
    </Drawer>
  );
}
