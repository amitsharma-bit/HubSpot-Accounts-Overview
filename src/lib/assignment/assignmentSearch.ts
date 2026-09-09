import { searchObjects, batchGetAssociations } from "../hubspot";
import { cached } from "../cache";
import { GROUP_OBJECT_TYPE, GROUP_TO_COMPANY_ASSOCIATION, GROUP_PROPERTY_LIST } from "./propertyMap";
import { mapGroupRecord, getOwnerToAssignmentMap } from "./groupService";
import { searchCompanyPool, getCompaniesByIds } from "./companyService";
import { evaluateFilterGroup, type FilterContext } from "./filterEngine";
import { qualifyGroupForUsAssignment } from "./eligibility";
import type { DealershipGroup, Company, FilterGroup, QualificationResult } from "./types";

/**
 * ONE canonical result shape for a search — every count on the page (Phase
 * 22/40: matching/eligible/excluded/qualification-failure counts) is read
 * off this same object, never recomputed independently elsewhere.
 */
export type GroupSearchResult = {
  total: number;
  groups: (DealershipGroup & { qualification: QualificationResult })[];
  totalEligible: number;
  totalExcluded: number;
};

const ALL_GROUPS_CACHE_KEY = "assignment:all-groups-base";
const ALL_GROUPS_TTL_MS = 5 * 60 * 1000;

/** Scans every Dealership Group's base properties + associated company IDs once, cached briefly. */
async function getAllGroupsBase(): Promise<DealershipGroup[]> {
  return cached(ALL_GROUPS_CACHE_KEY, ALL_GROUPS_TTL_MS, async () => {
    const ownerMap = await getOwnerToAssignmentMap();
    const all: { id: string; properties: Record<string, string | null> }[] = [];
    let after: string | undefined;
    do {
      const page = await searchObjects(GROUP_OBJECT_TYPE, {
        filterGroups: [{ filters: [] }],
        properties: GROUP_PROPERTY_LIST,
        limit: 100,
        after,
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      });
      all.push(...page.results);
      after = page.results.length === 100 ? String((Number(after ?? 0) || 0) + 100) : undefined;
    } while (after);

    const ids = all.map((r) => r.id);
    const associations = await batchGetAssociations(GROUP_OBJECT_TYPE, ids, GROUP_TO_COMPANY_ASSOCIATION);
    return all.map((r) => mapGroupRecord(r, ownerMap, associations.get(r.id) ?? []));
  });
}

export type GroupSearchInput = {
  filters: FilterGroup | null;
  search: string;
  requireUsQualified: boolean; // Phase 7's default US rule, toggle-able so a RevOps analyst can inspect excluded groups too
  sortField: keyof DealershipGroup | null;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

function textMatch(group: DealershipGroup, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    (group.groupName ?? "").toLowerCase().includes(t) ||
    group.id.includes(t) ||
    (group.city ?? "").toLowerCase().includes(t) ||
    (group.state ?? "").toLowerCase().includes(t)
  );
}

/**
 * The canonical Dealership Group search — filters, search, US-qualification,
 * sort, and pagination all operate on the SAME complete in-memory dataset
 * (Phase 21/40), not just the page being returned. See filterEngine.ts's
 * module doc for why this is in-memory rather than compiled into HubSpot
 * search filters: AGGREGATED_ROOFTOPS-scope filters have no HubSpot-side
 * equivalent at all.
 */
export async function searchGroupsCanonical(input: GroupSearchInput): Promise<GroupSearchResult> {
  const allGroups = await getAllGroupsBase();
  const textFiltered = allGroups.filter((g) => textMatch(g, input.search));

  // Only resolve full associated-company records (needed for US-qualification
  // and any AGGREGATED_ROOFTOPS filter) for groups that still have a chance —
  // i.e. after text search, before the expensive step, per Phase 38.
  const allCompanyIds = Array.from(new Set(textFiltered.flatMap((g) => g.associatedCompanyIds)));
  const companies = await getCompaniesByIds(allCompanyIds);
  const companiesByGroup = new Map<string, Company[]>();
  for (const g of textFiltered) {
    companiesByGroup.set(
      g.id,
      g.associatedCompanyIds.map((id) => companies.find((c) => c.id === id)).filter((c): c is Company => !!c)
    );
  }

  const evaluated = textFiltered.map((g) => {
    const groupCompanies = companiesByGroup.get(g.id) ?? [];
    const qualification = qualifyGroupForUsAssignment(groupCompanies);
    const ctx: FilterContext = { group: g, associatedCompanies: groupCompanies };
    const passesFilters = input.filters ? evaluateFilterGroup(input.filters, ctx) : true;
    return { group: g, qualification, passesFilters };
  });

  const totalEligible = evaluated.filter((e) => e.qualification.eligible).length;
  const totalExcluded = evaluated.length - totalEligible;

  let matching = evaluated.filter((e) => e.passesFilters && (!input.requireUsQualified || e.qualification.eligible));

  if (input.sortField) {
    const field = input.sortField;
    matching = [...matching].sort((a, b) => {
      const av = a.group[field];
      const bv = b.group[field];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return input.sortDir === "asc" ? cmp : -cmp;
    });
  }

  const start = (input.page - 1) * input.pageSize;
  const pageItems = matching.slice(start, start + input.pageSize);

  return {
    total: matching.length,
    groups: pageItems.map((e) => ({ ...e.group, qualification: e.qualification })),
    totalEligible,
    totalExcluded,
  };
}

export type CompanySearchInput = {
  dealershipClass: "Franchise" | "Independent";
  filters: FilterGroup | null;
  search: string;
  sortField: keyof Company | null;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

/**
 * Single Franchise / Independent Rooftop search. Uses HubSpot-side paging
 * for the base pool (real property filter, real dealershipClass filter) —
 * these two pools are company-scoped only (no rooftop aggregation is
 * possible for a standalone company), so no in-memory full-dataset scan is
 * needed the way Groups require; HubSpot's own filterGroups already apply
 * per Phase 21's "operate on the complete matching dataset" for company/text
 * filters expressible as real property comparisons. Client-composed
 * AND/OR/NOT trees beyond that (Phase 17) still evaluate in-memory per page,
 * same engine as Groups, for the fields the FilterGroup engine covers.
 */
export async function searchCompaniesCanonical(input: CompanySearchInput): Promise<{ total: number; companies: Company[] }> {
  const { total, companies } = await searchCompanyPool({
    dealershipClass: input.dealershipClass,
    page: input.page,
    pageSize: input.pageSize,
  });

  const term = input.search.toLowerCase();
  const filtered = companies.filter((c) => {
    if (term) {
      const matchesSearch =
        (c.companyName ?? "").toLowerCase().includes(term) ||
        (c.domain ?? "").toLowerCase().includes(term) ||
        (c.gdName ?? "").toLowerCase().includes(term) ||
        c.id.includes(term);
      if (!matchesSearch) return false;
    }
    if (input.filters) {
      const ctx: FilterContext = { company: c };
      return evaluateFilterGroup(input.filters, ctx);
    }
    return true;
  });

  if (input.sortField) {
    const field = input.sortField;
    filtered.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return input.sortDir === "asc" ? cmp : -cmp;
    });
  }

  return { total, companies: filtered };
}
