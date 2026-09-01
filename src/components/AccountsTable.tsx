"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useJson } from "@/lib/useJson";
import { useScopeParams } from "@/lib/useScopeParams";
import { fmt, fmtDate } from "@/lib/format";
import { TableSkeleton } from "./Skeletons";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { DealershipClassBadge } from "./Badge";
import { CompanyDetailDrawer } from "./CompanyDetailDrawer";
import { GroupDetailDrawer } from "./GroupDetailDrawer";
import { ROLE_ORDER } from "@/config/roster";
import type { AccountsResponse, CompanyRecord, MemberTotal } from "@/lib/types";

type ColumnKey =
  | "name"
  | "domain"
  | "owner"
  | "team"
  | "country"
  | "state"
  | "city"
  | "typeOfDealership"
  | "gdName"
  | "potentialRooftops"
  | "lastActivityDate";

const COLUMN_DEFS: { key: ColumnKey; label: string; width: string }[] = [
  { key: "name", label: "Company", width: "180px" },
  { key: "domain", label: "Domain", width: "150px" },
  { key: "owner", label: "Owner", width: "160px" },
  { key: "team", label: "Team", width: "130px" },
  { key: "country", label: "Country", width: "110px" },
  { key: "state", label: "State", width: "110px" },
  { key: "city", label: "City", width: "120px" },
  { key: "typeOfDealership", label: "Type of Dealership", width: "150px" },
  { key: "gdName", label: "GD Name", width: "170px" },
  { key: "potentialRooftops", label: "Potential Rooftops", width: "110px" },
  { key: "lastActivityDate", label: "Last Activity", width: "120px" },
];
const DEFAULT_ORDER: ColumnKey[] = COLUMN_DEFS.map((c) => c.key);
const NON_HIDEABLE: ColumnKey[] = ["name"];

// Only real HubSpot properties can be sorted server-side, across the whole
// filtered dataset (mirrors src/app/api/accounts/route.ts's SERVER_SORT_PROPERTIES).
// Owner/Team aren't stored HubSpot properties — they're joined in from the
// roster — so they sort only the rows already loaded on the client.
const SERVER_SORTABLE: ReadonlySet<ColumnKey> = new Set([
  "name",
  "domain",
  "country",
  "state",
  "city",
  "typeOfDealership",
  "gdName",
  "potentialRooftops",
  "lastActivityDate",
]);

type TabKey = "all" | "top" | "recent";
const TABS: { key: TabKey; label: string; sortBy: ColumnKey | null; sortDir: "asc" | "desc" }[] = [
  { key: "all", label: "All Accounts", sortBy: null, sortDir: "asc" },
  { key: "top", label: "Top Opportunities", sortBy: "potentialRooftops", sortDir: "desc" },
  { key: "recent", label: "Recent Activity", sortBy: "lastActivityDate", sortDir: "desc" },
];

const COLUMN_PREFS_KEY = "accounts-table-columns-v1";

function loadColumnPrefs(): { order: ColumnKey[]; hidden: ColumnKey[] } {
  if (typeof window === "undefined") return { order: DEFAULT_ORDER, hidden: [] };
  try {
    const raw = window.localStorage.getItem(COLUMN_PREFS_KEY);
    if (!raw) return { order: DEFAULT_ORDER, hidden: [] };
    const parsed = JSON.parse(raw) as { order?: string[]; hidden?: string[] };
    const validOrder = (parsed.order ?? []).filter((k): k is ColumnKey => DEFAULT_ORDER.includes(k as ColumnKey));
    const missing = DEFAULT_ORDER.filter((k) => !validOrder.includes(k));
    const hidden = (parsed.hidden ?? []).filter((k): k is ColumnKey => DEFAULT_ORDER.includes(k as ColumnKey));
    return { order: [...validOrder, ...missing], hidden };
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] };
  }
}

function cellValue(r: CompanyRecord, key: ColumnKey): string {
  switch (key) {
    case "owner":
      return r.ownerName ?? "";
    case "team":
      return r.team ?? "";
    default:
      return "";
  }
}

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
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const scope = useScopeParams();

  const [sortBy, setSortBy] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: ColumnKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  // Tabs are presets over the same real sort state used by column-header
  // clicks — "Top Opportunities" sorts by potential rooftops, "Recent
  // Activity" by last activity date. Manually sorting a column just means no
  // tab is highlighted, rather than the tabs tracking separate fake state.
  const activeTab = TABS.find((t) => t.sortBy === sortBy && (t.sortBy === null || t.sortDir === sortDir))?.key ?? null;
  function selectTab(tab: (typeof TABS)[number]) {
    setSortBy(tab.sortBy);
    setSortDir(tab.sortDir);
  }

  // Column order / visibility, persisted locally per browser.
  const [colPrefs, setColPrefs] = useState(() => loadColumnPrefs());
  useEffect(() => {
    window.localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(colPrefs));
  }, [colPrefs]);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const visibleColumns = colPrefs.order.filter((k) => !colPrefs.hidden.includes(k));

  // --- Accounts data: accumulates across "View More" clicks (page > 1
  // appends instead of replacing), resets to page 1 whenever a filter,
  // search term, or server-sortable column changes.
  const [rows, setRows] = useState<CompanyRecord[]>([]);
  const [meta, setMeta] = useState<Pick<AccountsResponse, "total" | "pageSize" | "totalPages" | "cappedByHubSpot"> | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const serverSortBy = sortBy && SERVER_SORTABLE.has(sortBy) ? sortBy : null;
  const resetKey = JSON.stringify({ team, role, ownerKey, q, scope: scope.toString(), serverSortBy, sortDir });
  // Adjusted during render (not an effect), per React's "adjust state when a
  // prop changes" pattern — avoids an extra render from setState-in-effect.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPagesLoaded(1);
  }

  // Same pattern for the loading flags: derived from (resetKey, pagesLoaded)
  // during render, rather than as a synchronous setState at the top of the
  // effect below — the effect itself only sets state inside async
  // .then/.catch/.finally callbacks, which the set-state-in-effect rule
  // doesn't (and shouldn't) flag.
  const fetchKey = `${resetKey}:${pagesLoaded}`;
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    if (pagesLoaded === 1) setInitialLoading(true);
    else setLoadingMore(true);
    setFetchError(null);
  }

  useEffect(() => {
    let cancelled = false;
    const isFirstPage = pagesLoaded === 1;

    const params = new URLSearchParams(scope);
    params.set("page", String(pagesLoaded));
    if (team) params.set("team", team);
    if (role) params.set("role", role);
    if (ownerKey) params.set("ownerId", ownerKey);
    if (q) params.set("q", q);
    if (serverSortBy) {
      params.set("sortBy", serverSortBy);
      params.set("sortDir", sortDir);
    }

    fetch(`/api/accounts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: AccountsResponse) => {
        if (cancelled) return;
        setRows((prev) => (isFirstPage ? json.rows : [...prev, ...json.rows]));
        setMeta({ total: json.total, pageSize: json.pageSize, totalPages: json.totalPages, cappedByHubSpot: json.cappedByHubSpot });
      })
      .catch((err) => {
        console.error("accounts fetch failed:", err);
        if (!cancelled) setFetchError("Unable to load HubSpot data. Please try again.");
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLoading(false);
          setLoadingMore(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, pagesLoaded]);

  // Client-only sort (Owner/Team) re-sorts whatever's already loaded; it
  // can't reach further HubSpot pages, since neither is a real sortable
  // HubSpot property — see SERVER_SORTABLE above.
  const displayRows = useMemo(() => {
    if (!sortBy || SERVER_SORTABLE.has(sortBy)) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => cellValue(a, sortBy).localeCompare(cellValue(b, sortBy)) * dir);
  }, [rows, sortBy, sortDir]);

  const memberParams = new URLSearchParams();
  if (team) memberParams.set("team", team);
  const { data: memberData } = useJson<{ members: MemberTotal[] }>(`/api/members?${memberParams.toString()}`);
  const { data: rosterData } = useJson<{ pods: string[] }>("/api/roster");

  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [openGdId, setOpenGdId] = useState<string | null>(null);

  // Keep rendering the last-opened drawer's content while it's animating
  // closed (openXId already went null) instead of unmounting it mid-slide —
  // Drawer itself decides when to actually remove from the DOM.
  const [lastCompanyId, setLastCompanyId] = useState<string | null>(null);
  if (openCompanyId !== null && openCompanyId !== lastCompanyId) setLastCompanyId(openCompanyId);
  const [lastGdId, setLastGdId] = useState<string | null>(null);
  if (openGdId !== null && openGdId !== lastGdId) setLastGdId(openGdId);

  function renderCell(r: CompanyRecord, key: ColumnKey) {
    switch (key) {
      case "name":
        return (
          <button className="link-button" onClick={() => setOpenCompanyId(r.id)} title={r.name ?? undefined}>
            {fmt(r.name)}
          </button>
        );
      case "domain":
        return fmt(r.domain);
      case "owner":
        return r.ownerName ? (
          <span className="person">
            <Avatar name={r.ownerName} size={22} />
            {r.ownerName}
          </span>
        ) : (
          "—"
        );
      case "team":
        return fmt(r.team);
      case "country":
        return fmt(r.country);
      case "state":
        return fmt(r.state);
      case "city":
        return fmt(r.city);
      case "typeOfDealership":
        return <DealershipClassBadge dealershipClass={r.dealershipClass} />;
      case "gdName":
        return r.inGroupDealership && r.gdId ? (
          <button className="link-button" onClick={() => setOpenGdId(r.gdId!)} title={r.gdName ?? undefined}>
            {fmt(r.gdName)}
          </button>
        ) : (
          "—"
        );
      case "potentialRooftops":
        return r.potentialRooftops ?? "—";
      case "lastActivityDate":
        return fmtDate(r.lastActivityDate);
    }
  }

  return (
    <div className="table-card">
      <div style={{ padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div className="tabs-row">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn${activeTab === tab.key ? " active" : ""}`}
              onClick={() => selectTab(tab)}
            >
              {tab.label}
            </button>
          ))}
          <div className="columns-menu-wrap" style={{ marginLeft: "auto" }}>
            <button className="btn btn-secondary" onClick={() => setColumnsMenuOpen((v) => !v)}>
              <Icon name="columns" size={15} /> Manage Columns
            </button>
            {columnsMenuOpen && (
              <ColumnsMenu
                prefs={colPrefs}
                onChange={setColPrefs}
                onClose={() => setColumnsMenuOpen(false)}
                dragIndex={dragIndex}
              />
            )}
          </div>
        </div>

        <div className="filter-bar">
          <label className="search-box-compact">
            <Icon name="search" size={14} />
            <input
              type="search"
              placeholder="Search company, domain, GD…"
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

      {initialLoading && <TableSkeleton />}
      {fetchError && <div className="muted" style={{ padding: "0 0.9rem 0.9rem" }}>{fetchError}</div>}
      {!initialLoading && displayRows.length === 0 && (
        <div className="muted" style={{ padding: "0 0.9rem 0.9rem" }}>No accounts match the current filters.</div>
      )}
      {!initialLoading && displayRows.length > 0 && meta && (
        <>
          <div className="table-scroll">
            <table style={{ tableLayout: "fixed" }}>
              <colgroup>
                {visibleColumns.map((key) => (
                  <col key={key} style={{ width: COLUMN_DEFS.find((c) => c.key === key)!.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {visibleColumns.map((key) => {
                    const def = COLUMN_DEFS.find((c) => c.key === key)!;
                    const isActive = sortBy === key;
                    return (
                      <th
                        key={key}
                        className={`sortable${isActive ? " sort-active" : ""}`}
                        onClick={() => toggleSort(key)}
                        title={`Sort by ${def.label}`}
                      >
                        {def.label}
                        <span className="sort-indicator">
                          <Icon name={isActive ? (sortDir === "asc" ? "chevronUp" : "chevronDown") : "chevronsUpDown"} size={13} />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.id}>
                    {visibleColumns.map((key) => (
                      <td key={key} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {renderCell(r, key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="muted">
              Showing 1–{displayRows.length.toLocaleString()} of {meta.total.toLocaleString()}
              {meta.cappedByHubSpot ? " (refine filters — HubSpot caps paged browsing at 10,000 rows)" : ""}
            </span>
            <button
              disabled={loadingMore || pagesLoaded >= meta.totalPages}
              onClick={() => setPagesLoaded((p) => p + 1)}
            >
              {loadingMore ? "Loading…" : "View More"}
            </button>
          </div>
        </>
      )}

      {lastCompanyId && (
        <CompanyDetailDrawer
          companyId={lastCompanyId}
          open={openCompanyId !== null}
          onClose={() => setOpenCompanyId(null)}
          onOpenGroup={setOpenGdId}
        />
      )}
      {lastGdId && <GroupDetailDrawer gdId={lastGdId} open={openGdId !== null} onClose={() => setOpenGdId(null)} />}
    </div>
  );
}

function ColumnsMenu({
  prefs,
  onChange,
  onClose,
  dragIndex,
}: {
  prefs: { order: ColumnKey[]; hidden: ColumnKey[] };
  onChange: (next: { order: ColumnKey[]; hidden: ColumnKey[] }) => void;
  onClose: () => void;
  dragIndex: React.MutableRefObject<number | null>;
}) {
  function move(from: number, to: number) {
    if (to < 0 || to >= prefs.order.length) return;
    const order = [...prefs.order];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    onChange({ ...prefs, order });
  }

  function toggleHidden(key: ColumnKey) {
    if (NON_HIDEABLE.includes(key)) return;
    const hidden = prefs.hidden.includes(key) ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key];
    onChange({ ...prefs, hidden });
  }

  return (
    <div className="columns-menu" onMouseLeave={onClose}>
      {prefs.order.map((key, i) => {
        const def = COLUMN_DEFS.find((c) => c.key === key)!;
        return (
          <div
            key={key}
            className="column-row"
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current !== null && dragIndex.current !== i) move(dragIndex.current, i);
              dragIndex.current = null;
            }}
          >
            <span className="column-drag-handle">
              <Icon name="dragHandle" size={14} />
            </span>
            <input
              type="checkbox"
              checked={!prefs.hidden.includes(key)}
              disabled={NON_HIDEABLE.includes(key)}
              onChange={() => toggleHidden(key)}
            />
            <span style={{ flex: 1 }}>{def.label}</span>
            <button className="drawer-close" style={{ width: 22, height: 22 }} disabled={i === 0} onClick={() => move(i, i - 1)}>
              <Icon name="chevronUp" size={12} />
            </button>
            <button
              className="drawer-close"
              style={{ width: 22, height: 22 }}
              disabled={i === prefs.order.length - 1}
              onClick={() => move(i, i + 1)}
            >
              <Icon name="chevronDown" size={12} />
            </button>
          </div>
        );
      })}
      <div className="columns-menu-footer">
        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => onChange({ order: DEFAULT_ORDER, hidden: [] })}>
          Reset to default
        </button>
      </div>
    </div>
  );
}
