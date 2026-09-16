import { searchCompanies, scanCompanies, listOwners } from "../hubspot";
import { getOwnerToAssignment } from "../rosterStore";
import { SYSTEM_OWNERS } from "@/config/roster";
import { findColumnDef, COMPANY_REPORT_COLUMNS } from "./companyProperties";
import { resolveAssociations } from "./associations";
import type { ReportDefinition, ReportRow, ReportOwnerOption } from "./types";
import type { FilterGroup, PropertyFilter } from "../types";

/**
 * These three date columns display as "DD-Month-Year" (e.g. "14-July-2026")
 * rather than the raw HubSpot ISO timestamp — requested specifically for
 * these three, not every datetime column, so "Create Date" etc. are left
 * as-is unless asked. HubSpot's own value is UTC; this renders the UTC
 * calendar date rather than shifting it to a viewer's local timezone, since
 * a report cell shouldn't silently change date depending on who's viewing it.
 */
const DATE_DISPLAY_COLUMNS = new Set(["Owner assigned date", "Last Activity Date", "Rooftop Last Activity"]);

export function formatReportDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // malformed value — show it as-is rather than hiding it
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

/**
 * Translates a ReportDefinition's owner selection + property-kind filters
 * into real HubSpot search filters — a single AND group (HubSpot's cap: 6
 * filters per group), exactly what this feature's "keep filters simple, no
 * nested AND/OR" requirement (Phase 9) already matches 1:1. Association-kind
 * columns can't be pushed down to a HubSpot filter at all (no such property
 * exists) — the UI never offers them as filterable fields.
 */
export function buildReportFilterGroups(def: ReportDefinition): FilterGroup[] {
  const filters: PropertyFilter[] = [];

  if (def.owners.includeUnassigned && def.owners.ownerIds.length === 0) {
    filters.push({ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" });
  } else if (def.owners.ownerIds.length > 0) {
    filters.push({ propertyName: "hubspot_owner_id", operator: "IN", values: def.owners.ownerIds.map(String) });
  }

  for (const f of def.filters.slice(0, 6 - filters.length)) {
    const columnDef = findColumnDef(f.columnKey);
    if (!columnDef || columnDef.kind !== "property" || !columnDef.internalName) continue; // association columns aren't filterable server-side
    const propertyName = columnDef.internalName;
    switch (f.operator) {
      case "is":
      case "equals":
        filters.push({ propertyName, operator: "EQ", value: f.value });
        break;
      case "isNot":
        filters.push({ propertyName, operator: "NEQ", value: f.value });
        break;
      case "contains":
        filters.push({ propertyName, operator: "CONTAINS_TOKEN", value: f.value });
        break;
      case "doesNotContain":
        filters.push({ propertyName, operator: "NOT_CONTAINS_TOKEN", value: f.value });
        break;
      case "isKnown":
        filters.push({ propertyName, operator: "HAS_PROPERTY" });
        break;
      case "isUnknown":
        filters.push({ propertyName, operator: "NOT_HAS_PROPERTY" });
        break;
      case "greaterThan":
        filters.push({ propertyName, operator: "GT", value: f.value });
        break;
      case "lessThan":
        filters.push({ propertyName, operator: "LT", value: f.value });
        break;
      case "greaterThanOrEqual":
        filters.push({ propertyName, operator: "GTE", value: f.value });
        break;
      case "lessThanOrEqual":
        filters.push({ propertyName, operator: "LTE", value: f.value });
        break;
    }
  }

  return [{ filters: filters.slice(0, 6) }];
}

function propertyColumnNames(columns: string[]): string[] {
  return columns
    .map((label) => findColumnDef(label))
    .filter((c): c is NonNullable<typeof c> => !!c && c.kind === "property" && !!c.internalName)
    .map((c) => c.internalName as string);
}

async function ownerAndTeamLookup(): Promise<{ names: Map<number, string>; teams: Map<number, string> }> {
  const [owners, assignments] = await Promise.all([listOwners(), getOwnerToAssignment()]);
  const names = new Map(owners.map((o) => [o.ownerId, o.name]));
  const teams = new Map<number, string>();
  for (const [ownerId, a] of assignments) teams.set(ownerId, a.pod);
  return { names, teams };
}

/** Maps a raw HubSpot record + resolved lookups into one report row, in the caller's requested column order. */
function mapRow(
  raw: { id: string; properties: Record<string, string | null> },
  columns: string[],
  ownerNames: Map<number, string>,
  ownerTeams: Map<number, string>,
  assoc: Awaited<ReturnType<typeof resolveAssociations>> | null
): ReportRow {
  const row: ReportRow = {};
  for (const label of columns) {
    const def = findColumnDef(label);
    if (!def) {
      row[label] = null;
      continue;
    }
    if (def.kind === "property" && def.internalName) {
      if (def.internalName === "hubspot_owner_id") {
        const ownerId = raw.properties.hubspot_owner_id ? Number(raw.properties.hubspot_owner_id) : null;
        row[label] = ownerId !== null ? ownerNames.get(ownerId) ?? String(ownerId) : null;
      } else if (def.internalName === "hubspot_team_id") {
        // Derived from the Company Owner's roster pod (Phase 16) — not HubSpot's native Team object. See the caveat on this column's definition.
        const ownerId = raw.properties.hubspot_owner_id ? Number(raw.properties.hubspot_owner_id) : null;
        row[label] = ownerId !== null ? ownerTeams.get(ownerId) ?? null : null;
      } else {
        const v = raw.properties[def.internalName];
        if (def.type === "number" && v !== null && v !== undefined && v !== "") {
          row[label] = Number(v);
        } else if (DATE_DISPLAY_COLUMNS.has(label)) {
          row[label] = formatReportDate(v);
        } else {
          row[label] = v;
        }
      }
      continue;
    }
    // Association-kind column.
    if (!assoc) {
      row[label] = null;
      continue;
    }
    if (def.associationObjectType === "DEAL") {
      const ids = assoc.dealIds.get(raw.id) ?? [];
      row[label] = label.endsWith("IDs") ? ids.join(", ") || null : ids[0] ? assoc.dealNames.get(ids[0]) ?? ids[0] : null;
    } else if (def.associationObjectType === "CONTACT") {
      const ids = assoc.contactIds.get(raw.id) ?? [];
      row[label] = label.endsWith("IDs") ? ids.join(", ") || null : ids[0] ? assoc.contactNames.get(ids[0]) ?? ids[0] : null;
    } else if (def.associationObjectType === "DEALERSHIP_GROUP") {
      const ids = assoc.groupIds.get(raw.id) ?? [];
      row[label] = ids.join(", ") || null;
    }
  }
  return row;
}

function neededAssociations(columns: string[]): { deal: boolean; contact: boolean; group: boolean } {
  const defs = columns.map(findColumnDef).filter((c): c is NonNullable<typeof c> => !!c && c.kind === "association");
  return {
    deal: defs.some((c) => c.associationObjectType === "DEAL"),
    contact: defs.some((c) => c.associationObjectType === "CONTACT"),
    group: defs.some((c) => c.associationObjectType === "DEALERSHIP_GROUP"),
  };
}

const PREVIEW_PAGE_SIZE = 50;

/** Preview: one real page (Phase 11 — 25-50 rows), same canonical query as the export. */
export async function searchReportPreview(def: ReportDefinition, page: number): Promise<{ total: number; rows: ReportRow[] }> {
  const filterGroups = buildReportFilterGroups(def);
  const propertyNames = Array.from(new Set(["hs_object_id", "hubspot_owner_id", ...propertyColumnNames(def.columns)]));
  const { total, results } = await searchCompanies(filterGroups, page, propertyNames, { pageSize: PREVIEW_PAGE_SIZE });

  const [{ names, teams }, assoc] = await Promise.all([
    ownerAndTeamLookup(),
    (async () => {
      const need = neededAssociations(def.columns);
      if (!need.deal && !need.contact && !need.group) return null;
      return resolveAssociations(
        results.map((r) => r.id),
        need
      );
    })(),
  ]);

  return { total, rows: results.map((r) => mapRow(r, def.columns, names, teams, assoc)) };
}

/**
 * Full-dataset export (Phase 12 — the CSV must be the complete filtered set,
 * never just the preview page). Streams through every matching company via
 * scanCompanies (already built for exactly this "need every real record"
 * case), resolving association columns in per-page batches rather than one
 * request per row.
 */
export async function* exportReportRows(def: ReportDefinition): AsyncGenerator<ReportRow[]> {
  const filterGroups = buildReportFilterGroups(def);
  const propertyNames = Array.from(new Set(["hs_object_id", "hubspot_owner_id", ...propertyColumnNames(def.columns)]));
  const need = neededAssociations(def.columns);
  const { names, teams } = await ownerAndTeamLookup();

  for await (const page of scanCompanies(filterGroups, propertyNames)) {
    const assoc = need.deal || need.contact || need.group ? await resolveAssociations(page.map((r) => r.id), need) : null;
    yield page.map((r) => mapRow(r, def.columns, names, teams, assoc));
  }
}

/**
 * `scope: "dashboard"` (the default the UI starts on, Phase 23) returns only
 * active dashboard members plus the known system/bulk-import buckets.
 * `scope: "all"` is the explicit opt-in to browse every real HubSpot owner —
 * never shown by default, so the owner picker doesn't quietly turn back into
 * a dump of the whole HubSpot user directory.
 */
export async function listReportOwners(scope: "dashboard" | "all" = "dashboard"): Promise<ReportOwnerOption[]> {
  const [owners, assignments] = await Promise.all([listOwners(), getOwnerToAssignment()]);
  const systemIds = new Set(Object.keys(SYSTEM_OWNERS).map(Number));
  return owners
    .filter((o) => o.name.trim().length > 0 && !o.archived)
    .filter((o) => scope === "all" || assignments.has(o.ownerId) || systemIds.has(o.ownerId))
    .map((o) => ({
      ownerId: o.ownerId,
      name: o.name,
      team: assignments.get(o.ownerId)?.pod ?? "Unassigned",
      isSystemOwner: systemIds.has(o.ownerId),
      isDashboardMember: assignments.has(o.ownerId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function allReportColumnLabels(): string[] {
  return COMPANY_REPORT_COLUMNS.map((c) => c.label);
}
