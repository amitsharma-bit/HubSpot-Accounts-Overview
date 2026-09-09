import { redis } from "../redis";
import type { SavedView, FilterGroup, FilterDefinition, AssignmentType } from "./types";

/**
 * Saved views, persisted in a NEW Redis key namespace ("assignment:*") —
 * does not touch roster:v1 or owner-counts:*, so this can't collide with or
 * corrupt anything Overview/Control Center already reads or writes.
 */
const SAVED_VIEWS_KEY = "assignment:saved-views:v1";

export async function listSavedViews(): Promise<SavedView[]> {
  const raw = await redis.hgetall(SAVED_VIEWS_KEY);
  return Object.values(raw)
    .map((v) => JSON.parse(v) as SavedView)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSavedView(input: Omit<SavedView, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<SavedView> {
  const now = new Date().toISOString();
  const existing = input.id ? await redis.hget(SAVED_VIEWS_KEY, input.id) : null;
  const parsed = existing ? (JSON.parse(existing) as SavedView) : null;
  const view: SavedView = {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    assignmentType: input.assignmentType,
    filters: input.filters,
    search: input.search,
    sort: input.sort,
    visibleColumns: input.visibleColumns,
    createdBy: parsed?.createdBy ?? input.createdBy,
    createdAt: parsed?.createdAt ?? now,
    updatedAt: now,
  };
  await redis.hset(SAVED_VIEWS_KEY, view.id, JSON.stringify(view));
  return view;
}

export async function deleteSavedView(id: string): Promise<void> {
  await redis.hdel(SAVED_VIEWS_KEY, id);
}

/**
 * Reusable filter presets (Phase 34/35) — represented as real FilterGroup
 * trees over the same engine, not a second filtering code path. Not
 * persisted (they're code, not user data); "Saved Views" above is where a
 * user's own saved combination of these lives.
 */
const leaf = (filter: FilterDefinition): FilterGroup => ({ kind: "leaf", filter });

export const FILTER_PRESETS: { name: string; assignmentType: AssignmentType; filters: FilterGroup }[] = [
  {
    name: "US TAM",
    assignmentType: "DEALERSHIP_GROUP",
    filters: leaf({ field: "country", scope: "AGGREGATED_ROOFTOPS", fieldType: "ENUM", operator: "equals", value: "United States", aggregation: "ALL" }),
  },
  {
    name: "5+ Rooftops",
    assignmentType: "DEALERSHIP_GROUP",
    filters: leaf({ field: "actualRooftops", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThanOrEqual", value: 5 }),
  },
  {
    name: "No Activity 90 Days",
    assignmentType: "DEALERSHIP_GROUP",
    filters: leaf({ field: "gdLastActivity", scope: "GROUP", fieldType: "DATE", operator: "olderThan", value: 90 }),
  },
  {
    name: "High Used Inventory",
    assignmentType: "DEALERSHIP_GROUP",
    filters: leaf({ field: "usedCars", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThan", value: 500 }),
  },
  {
    name: "Unassigned",
    assignmentType: "SINGLE_FRANCHISE",
    filters: leaf({ field: "companyOwnerId", scope: "COMPANY", fieldType: "NUMBER", operator: "isUnknown" }),
  },
  {
    name: "Recently Added",
    assignmentType: "INDEPENDENT_ROOFTOP",
    filters: leaf({ field: "createdDate", scope: "COMPANY", fieldType: "DATE", operator: "withinLast", value: 30 }),
  },
  {
    name: "Stale Data",
    assignmentType: "INDEPENDENT_ROOFTOP",
    filters: leaf({ field: "lastActivityDate", scope: "COMPANY", fieldType: "DATE", operator: "olderThan", value: 180 }),
  },
];
