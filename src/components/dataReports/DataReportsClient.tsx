"use client";

import { useMemo, useRef, useState } from "react";
import { useJson } from "@/lib/useJson";
import { Drawer, DrawerSection, DrawerField } from "@/components/Drawer";
import { COMPANY_REPORT_COLUMNS, CATEGORY_ORDER, DEFAULT_COLUMNS, findColumnDef, KNOWN_AMBIGUOUS_PROPERTY_NOTE } from "@/lib/dataReports/companyProperties";
import type { ReportColumnDef, ReportDefinition, ReportFilter, ReportOwnerOption, ReportRow, SavedReport, FilterOperator } from "@/lib/dataReports/types";

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  doesNotContain: "does not contain",
  isKnown: "is known",
  isUnknown: "is unknown",
  equals: "equals",
  greaterThan: "greater than",
  lessThan: "less than",
  greaterThanOrEqual: "greater than or equal to",
  lessThanOrEqual: "less than or equal to",
};

function operatorsFor(def: ReportColumnDef | undefined): FilterOperator[] {
  if (!def) return ["is", "isNot", "isKnown", "isUnknown"];
  if (def.type === "number" || def.type === "datetime") {
    return ["equals", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual", "isKnown", "isUnknown"];
  }
  return ["is", "isNot", "contains", "doesNotContain", "isKnown", "isUnknown"];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function DataReportsClient() {
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerScope, setOwnerScope] = useState<"dashboard" | "all">("dashboard");
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [page, setPage] = useState(1);
  const [savedReportsOpen, setSavedReportsOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "done" | "failed">("idle");
  const [exportedCsvUrl, setExportedCsvUrl] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  const { data: ownersData } = useJson<{ owners: ReportOwnerOption[] }>(`/api/data-reports/owners?scope=${ownerScope}`);
  const { data: savedReportsData } = useJson<{ reports: SavedReport[] }>(savedReportsOpen ? "/api/data-reports/saved-reports" : null);
  const { data: recentExportsData } = useJson<{ exports: { id: string; reportName: string; recordCount: number; exportedAt: string }[] }>(
    "/api/data-reports/recent-exports"
  );

  const definition: ReportDefinition = useMemo(
    () => ({ owners: { ownerIds, includeUnassigned }, columns, filters }),
    [ownerIds, includeUnassigned, columns, filters]
  );

  const hasConfig = ownerIds.length > 0 || includeUnassigned;

  // Adjust preview state during render when the query definition changes,
  // per this codebase's established pattern (compare-against-prev instead of
  // useEffect + setState) — see AccountsTable.tsx.
  const defKey = JSON.stringify(definition);
  const [prevDefKey, setPrevDefKey] = useState(defKey);
  if (defKey !== prevDefKey) {
    setPrevDefKey(defKey);
    setPage(1);
  }

  const [previewResult, setPreviewResult] = useState<{ total: number; rows: ReportRow[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const fetchKey = `${defKey}:${page}`;
  const [prevFetchKey, setPrevFetchKey] = useState<string | null>(null);
  if (hasConfig && columns.length > 0 && fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setPreviewLoading(true);
    setPreviewError(null);
    postJson<{ total: number; rows: ReportRow[] }>("/api/data-reports/search", { definition, page })
      .then((r) => {
        setPreviewResult(r);
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewError("Unable to load HubSpot data. Please try again.");
        setPreviewLoading(false);
      });
  }

  const ownerOptions = (ownersData?.owners ?? []).filter((o) => o.name.toLowerCase().includes(ownerSearch.toLowerCase()));
  const salesOpsOwners = (ownersData?.owners ?? []).filter((o) => o.isSystemOwner);

  function toggleOwner(id: number) {
    setOwnerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function selectAllOwners() {
    setOwnerIds((ownersData?.owners ?? []).map((o) => o.ownerId));
  }
  function clearOwners() {
    setOwnerIds([]);
    setIncludeUnassigned(false);
  }
  function selectAllSalesOps() {
    setOwnerIds(salesOpsOwners.map((o) => o.ownerId));
  }

  function addColumn(label: string) {
    setColumns((c) => (c.includes(label) ? c : [...c, label]));
  }
  function removeColumn(label: string) {
    setColumns((c) => c.filter((l) => l !== label));
  }
  function resetColumns() {
    setColumns(DEFAULT_COLUMNS);
  }
  function moveColumn(from: number, to: number) {
    if (to < 0 || to >= columns.length) return;
    setColumns((c) => {
      const next = [...c];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function addFilter() {
    const firstFilterable = COMPANY_REPORT_COLUMNS.find((c) => c.kind === "property");
    if (!firstFilterable) return;
    setFilters((f) => [...f, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, columnKey: firstFilterable.label, operator: "is", value: "" }]);
  }
  function updateFilter(id: string, patch: Partial<ReportFilter>) {
    setFilters((f) => f.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
  function removeFilter(id: string) {
    setFilters((f) => f.filter((row) => row.id !== id));
  }

  async function saveReport() {
    if (!saveName.trim()) return;
    await postJson("/api/data-reports/saved-reports", { name: saveName.trim(), description: saveDescription, definition, createdBy: "current-user" });
    setSaveModalOpen(false);
    setSaveName("");
    setSaveDescription("");
  }

  function loadReport(report: SavedReport) {
    setOwnerIds(report.definition.owners.ownerIds);
    setIncludeUnassigned(report.definition.owners.includeUnassigned);
    setColumns(report.definition.columns);
    setFilters(report.definition.filters);
    setSavedReportsOpen(false);
  }

  async function deleteReport(id: string) {
    await fetch(`/api/data-reports/saved-reports?id=${id}`, { method: "DELETE" });
    setSavedReportsOpen(false);
    setSavedReportsOpen(true); // force refetch of the list
  }

  async function runExport() {
    setExportState("exporting");
    try {
      const res = await fetch("/api/data-reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition, reportName: saveName || "Company Report", exportedBy: "current-user" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      setExportedCsvUrl(URL.createObjectURL(blob));
      setExportState("done");
    } catch {
      setExportState("failed");
    }
  }

  const filterableColumns = COMPANY_REPORT_COLUMNS.filter((c) => c.kind === "property");

  return (
    <div className="section">
      <div className="page-header-row">
        <div className="page-header">
          <h1>Data Reports</h1>
          <p>Build, filter and export company records</p>
        </div>
        <div className="header-right">
          <div className="columns-menu-wrap">
            <button className="btn btn-secondary" onClick={() => setSavedReportsOpen((v) => !v)}>
              Saved Reports ▾
            </button>
            {savedReportsOpen && (
              <div className="columns-menu" style={{ width: 320 }}>
                {(savedReportsData?.reports ?? []).length === 0 && <div className="muted" style={{ padding: "0.5rem" }}>No saved reports yet.</div>}
                {(savedReportsData?.reports ?? []).map((r) => (
                  <div key={r.id} className="column-row" style={{ justifyContent: "space-between" }}>
                    <button className="link-button" onClick={() => loadReport(r)} style={{ flex: 1, textAlign: "left" }}>
                      {r.name}
                    </button>
                    <button onClick={() => deleteReport(r.id)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setSaveModalOpen(true)}>
            Save Report
          </button>
        </div>
      </div>

      {!hasConfig && (
        <div className="panel" style={{ alignItems: "center", textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <div className="panel-title">Build your company report</div>
          <p className="muted">
            Select one or more Company Owners to get started. Choose the company properties you want in your export, add optional
            filters, preview the results, and export the complete dataset as CSV.
          </p>
        </div>
      )}

      {/* -------------------- Company Owner -------------------- */}
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title">Company Owner</div>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 600 }}>
            <input type="checkbox" checked={ownerScope === "all"} onChange={(e) => setOwnerScope(e.target.checked ? "all" : "dashboard")} />
            Show all HubSpot owners (not just active dashboard members)
          </label>
        </div>
        <label className="search-box-compact" style={{ width: 280 }}>
          <input placeholder="Search owners…" value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} />
        </label>

        {ownerIds.length > 0 && (
          <div className="filter-bar">
            {ownerIds.map((id) => {
              const owner = ownersData?.owners.find((o) => o.ownerId === id);
              return (
                <span key={id} className="chip">
                  {owner?.name ?? id} <button onClick={() => toggleOwner(id)}>&times;</button>
                </span>
              );
            })}
          </div>
        )}
        {includeUnassigned && (
          <span className="chip">
            Unassigned <button onClick={() => setIncludeUnassigned(false)}>&times;</button>
          </span>
        )}

        <div className="filter-bar">
          {ownerOptions.slice(0, 12).map((o) => (
            <button key={o.ownerId} className={`pill${ownerIds.includes(o.ownerId) ? " selected" : ""}`} onClick={() => toggleOwner(o.ownerId)}>
              {o.name} <span className="count">{o.team}</span>
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <span className="muted">Quick Select:</span>
          <button className="btn btn-secondary" onClick={selectAllSalesOps}>
            All SalesOps
          </button>
          <button className="btn btn-secondary" onClick={() => setIncludeUnassigned(true)}>
            Unassigned
          </button>
          <button className="btn btn-secondary" onClick={selectAllOwners}>
            Select All
          </button>
          <button className="btn btn-secondary" onClick={clearOwners}>
            Clear All
          </button>
        </div>

        <div className="muted">
          {ownerIds.length + (includeUnassigned ? 1 : 0)} owner selection{ownerIds.length === 1 && !includeUnassigned ? "" : "s"}
          {previewResult ? ` — ${previewResult.total.toLocaleString()} company records` : ""}
        </div>
      </div>

      {/* -------------------- Columns -------------------- */}
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title">Columns</div>
          <span className="muted">{columns.length} selected</span>
        </div>

        <div className="filter-bar">
          {columns.map((label, i) => (
            <span
              key={label}
              className="chip"
              draggable
              onDragStart={() => {
                dragIndex.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) moveColumn(dragIndex.current, i);
                dragIndex.current = null;
              }}
              style={{ cursor: "grab" }}
            >
              ⠿ {label}
              {!["Record ID"].includes(label) && <button onClick={() => removeColumn(label)}>&times;</button>}
            </span>
          ))}
        </div>

        <div className="filter-bar">
          <div className="columns-menu-wrap">
            <button className="btn btn-secondary" onClick={() => setColumnMenuOpen((v) => !v)}>
              + Add Columns
            </button>
            {columnMenuOpen && (
              <div className="columns-menu" style={{ width: 320, maxHeight: 420, overflowY: "auto" }}>
                <label className="search-box-compact" style={{ width: "100%", marginBottom: "0.4rem" }}>
                  <input placeholder="Search company properties…" value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} />
                </label>
                {CATEGORY_ORDER.map((category) => {
                  const inCategory = COMPANY_REPORT_COLUMNS.filter(
                    (c) => c.category === category && c.label.toLowerCase().includes(columnSearch.toLowerCase())
                  );
                  if (inCategory.length === 0) return null;
                  return (
                    <div key={category} style={{ marginBottom: "0.4rem" }}>
                      <div className="filter-panel-label" style={{ padding: "0.2rem 0.3rem" }}>
                        {category}
                      </div>
                      {inCategory.map((c) => (
                        <label key={c.label} className="column-row">
                          <input type="checkbox" checked={columns.includes(c.label)} onChange={() => (columns.includes(c.label) ? removeColumn(c.label) : addColumn(c.label))} />
                          <span style={{ flex: 1 }}>{c.label}</span>
                          {c.kind === "association" && <span className="badge">association</span>}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={resetColumns}>
            Reset Columns
          </button>
        </div>
      </div>

      {/* -------------------- Filters -------------------- */}
      <div className="panel">
        <div className="panel-title">Filters</div>
        {filters.map((f) => {
          const def = findColumnDef(f.columnKey);
          return (
            <div key={f.id} className="filter-bar">
              <select value={f.columnKey} onChange={(e) => updateFilter(f.id, { columnKey: e.target.value, operator: "is", value: "" })}>
                {filterableColumns.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select value={f.operator} onChange={(e) => updateFilter(f.id, { operator: e.target.value as FilterOperator })}>
                {operatorsFor(def).map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              {f.operator !== "isKnown" && f.operator !== "isUnknown" && (
                <input value={f.value} onChange={(e) => updateFilter(f.id, { value: e.target.value })} placeholder="value" style={{ width: 160 }} />
              )}
              <button onClick={() => removeFilter(f.id)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>
          );
        })}
        <button className="btn btn-secondary" onClick={addFilter}>
          + Add Filter
        </button>
      </div>

      {/* -------------------- Result Summary -------------------- */}
      {hasConfig && (
        <div className="card-grid">
          <div className="card">
            <div className="label">Company Records</div>
            <div className="value">{previewResult ? previewResult.total.toLocaleString() : "—"}</div>
          </div>
          <div className="card">
            <div className="label">Owners</div>
            <div className="value">{ownerIds.length + (includeUnassigned ? 1 : 0)}</div>
          </div>
          <div className="card">
            <div className="label">Columns</div>
            <div className="value">{columns.length}</div>
          </div>
        </div>
      )}

      {/* -------------------- Preview -------------------- */}
      {hasConfig && columns.length === 0 && <div className="muted">Select at least one column for the report.</div>}
      {hasConfig && columns.length > 0 && (
        <div className="panel">
          <div className="panel-title-row">
            <div className="panel-title">Preview</div>
            {previewResult && (
              <span className="muted">
                Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, previewResult.total)} of {previewResult.total.toLocaleString()}
              </span>
            )}
          </div>
          {previewLoading && <div className="muted">Loading…</div>}
          {previewError && <div className="muted">{previewError}</div>}
          {!previewLoading && previewResult && previewResult.rows.length === 0 && (
            <div className="muted">No company records found. Try changing the selected owners or filters.</div>
          )}
          {!previewLoading && previewResult && previewResult.rows.length > 0 && (
            <>
              <div className="table-scroll">
                <table style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c} style={{ position: "sticky", top: 0 }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.rows.map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c}>{row[c] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span className="muted">Page {page}</span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button disabled={page * 50 >= previewResult.total} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={() => setExportModalOpen(true)} disabled={!hasConfig || columns.length === 0}>
            Export CSV
          </button>
        </div>
      )}

      {/* -------------------- Recent Exports -------------------- */}
      <div className="section">
        <div className="section-title">Recent Exports</div>
        {(recentExportsData?.exports ?? []).length === 0 && <div className="muted">No exports yet.</div>}
        {(recentExportsData?.exports ?? []).map((e) => (
          <div key={e.id} className="filter-bar" style={{ justifyContent: "space-between" }}>
            <span>{e.reportName}</span>
            <span className="muted">
              {e.recordCount.toLocaleString()} records — {new Date(e.exportedAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: "0.72rem" }}>{KNOWN_AMBIGUOUS_PROPERTY_NOTE}</p>

      {/* -------------------- Save Report modal -------------------- */}
      <Drawer open={saveModalOpen} title="Save Report" onClose={() => setSaveModalOpen(false)}>
        <DrawerSection title="Report Details">
          <div style={{ padding: "0.6rem" }}>
            <label className="filter-field">
              <span>Report Name</span>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </label>
            <label className="filter-field" style={{ marginTop: "0.6rem" }}>
              <span>Description (optional)</span>
              <input value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} />
            </label>
            <div className="filter-bar" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" onClick={saveReport} disabled={!saveName.trim()}>
                Save Report
              </button>
              <button className="btn btn-secondary" onClick={() => setSaveModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </DrawerSection>
      </Drawer>

      {/* -------------------- Export modal -------------------- */}
      <Drawer
        open={exportModalOpen}
        title="Export Company Records"
        onClose={() => {
          setExportModalOpen(false);
          setExportState("idle");
        }}
      >
        <DrawerSection title="Summary">
          <DrawerField label="Owners" value={ownerOptions.filter((o) => ownerIds.includes(o.ownerId)).map((o) => o.name).join(", ") || (includeUnassigned ? "Unassigned" : "—")} />
          <DrawerField label="Filters" value={filters.length === 0 ? "None" : filters.map((f) => `${f.columnKey} ${OPERATOR_LABELS[f.operator]} ${f.value}`).join("; ")} />
          <DrawerField label="Records" value={previewResult ? previewResult.total.toLocaleString() : "—"} />
          <DrawerField label="Columns" value={columns.length} />
        </DrawerSection>
        <div style={{ padding: "0 0.6rem" }}>
          {exportState === "idle" && (
            <div className="filter-bar">
              <button className="btn btn-primary" onClick={runExport}>
                Export CSV
              </button>
              <button className="btn btn-secondary" onClick={() => setExportModalOpen(false)}>
                Cancel
              </button>
            </div>
          )}
          {exportState === "exporting" && <div className="muted">Exporting… Preparing {previewResult?.total.toLocaleString() ?? ""} company records</div>}
          {exportState === "failed" && (
            <div>
              <div className="muted">Export failed. We couldn&apos;t generate the report. Please try again.</div>
              <button className="btn btn-primary" onClick={runExport} style={{ marginTop: "0.5rem" }}>
                Retry
              </button>
            </div>
          )}
          {exportState === "done" && exportedCsvUrl && (
            <div>
              <div className="muted">Export complete — {previewResult?.total.toLocaleString() ?? ""} records exported</div>
              <a className="btn btn-primary" href={exportedCsvUrl} download={`${saveName || "company-report"}.csv`} style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                Download CSV
              </a>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
