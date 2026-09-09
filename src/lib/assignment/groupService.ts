import { searchObjects, getObjectById, batchGetAssociations, type SortSpec } from "../hubspot";
import { getOwnerToAssignment } from "../rosterStore";
import { GROUP_OBJECT_TYPE, GROUP_TO_COMPANY_ASSOCIATION, GROUP_PROPERTIES, GROUP_PROPERTY_LIST } from "./propertyMap";
import { getCompaniesByIds } from "./companyService";
import { qualifyGroupForUsAssignment } from "./eligibility";
import type { DealershipGroup, Company, QualificationResult } from "./types";
import type { FilterGroup as HubspotFilterGroup } from "../types";

type RawRecord = { id: string; properties: Record<string, string | null> };

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function getOwnerToAssignmentMap(): Promise<Map<number, { name: string; pod: string }>> {
  const raw = await getOwnerToAssignment();
  const out = new Map<number, { name: string; pod: string }>();
  for (const [ownerId, a] of raw) out.set(ownerId, { name: a.name, pod: a.pod });
  return out;
}
const ownerLookup = getOwnerToAssignmentMap;

export function mapGroupRecord(raw: RawRecord, ownerMap: Map<number, { name: string; pod: string }>, associatedCompanyIds: string[]): DealershipGroup {
  const p = raw.properties;
  const ownerId = num(p[GROUP_PROPERTIES.ownerId]);
  const assignment = ownerId !== null ? ownerMap.get(ownerId) : undefined;
  return {
    id: raw.id,
    recordId: raw.id,
    groupName: p[GROUP_PROPERTIES.groupName] ?? null,
    owner: assignment?.name ?? null,
    ownerId,
    ownerTeam: assignment?.pod ?? null,
    ownerAssignedDate: p[GROUP_PROPERTIES.ownerAssignedDate] ?? null,
    dealershipRank: p[GROUP_PROPERTIES.dealershipRank] ?? null,
    potentialRooftops: null, // KNOWN GAP — see propertyMap.ts's GROUP_KNOWN_GAPS
    actualRooftops: num(p[GROUP_PROPERTIES.actualRooftops]),
    gdStage: p[GROUP_PROPERTIES.gdStage] ?? null,
    gdTier: p[GROUP_PROPERTIES.gdTier] ?? null,
    gdLastActivity: p[GROUP_PROPERTIES.gdLastActivity] ?? null,
    gdCreatedDate: p[GROUP_PROPERTIES.createdDate] ?? null,
    gdLastModifiedDate: p[GROUP_PROPERTIES.lastModifiedDate] ?? null,
    currentStatus: p[GROUP_PROPERTIES.currentStatus] ?? null,
    country: null,
    state: null,
    city: null,
    county: null,
    associatedCompanyIds,
    associatedCompanyCount: associatedCompanyIds.length,
    contactsCount: null, // KNOWN GAP
    usedCars: num(p[GROUP_PROPERTIES.usedCars]),
    newCars: num(p[GROUP_PROPERTIES.newCars]),
    totalCars: num(p[GROUP_PROPERTIES.totalCars]),
    marketSegment: null, // KNOWN GAP
  };
}

/**
 * Paginated Dealership Group search. `nativeFilters` lets a caller push
 * real Group-object property filters (e.g. gd_stage) down to HubSpot;
 * anything that needs the associated companies (US qualification, rooftop
 * aggregation) is resolved afterward for just this page's groups, never for
 * all 3,417 up front (Phase 38).
 */
export async function searchGroups(input: {
  nativeFilters?: HubspotFilterGroup[];
  page: number;
  pageSize: number;
  sort?: SortSpec;
}): Promise<{ total: number; groups: DealershipGroup[] }> {
  const filterGroups = input.nativeFilters ?? [{ filters: [] }];
  const [searchResult, ownerMap] = await Promise.all([
    searchObjects(GROUP_OBJECT_TYPE, {
      filterGroups,
      properties: GROUP_PROPERTY_LIST,
      limit: input.pageSize,
      after: String((input.page - 1) * input.pageSize),
      sorts: input.sort ? [input.sort] : [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
    }),
    ownerLookup(),
  ]);

  const groupIds = searchResult.results.map((r) => r.id);
  const associations = await batchGetAssociations(GROUP_OBJECT_TYPE, groupIds, GROUP_TO_COMPANY_ASSOCIATION);

  const groups = searchResult.results.map((r) => mapGroupRecord(r, ownerMap, associations.get(r.id) ?? []));
  return { total: searchResult.total, groups };
}

export async function getGroupById(id: string): Promise<DealershipGroup | null> {
  const [raw, ownerMap, associations] = await Promise.all([
    getObjectById(GROUP_OBJECT_TYPE, id, GROUP_PROPERTY_LIST),
    ownerLookup(),
    batchGetAssociations(GROUP_OBJECT_TYPE, [id], GROUP_TO_COMPANY_ASSOCIATION),
  ]);
  if (!raw) return null;
  return mapGroupRecord(raw, ownerMap, associations.get(id) ?? []);
}

/** Full detail: the Group plus every one of its real, associated Company records. */
export async function getGroupDetailWithCompanies(id: string): Promise<{ group: DealershipGroup; companies: Company[] } | null> {
  const group = await getGroupById(id);
  if (!group) return null;
  const companies = await getCompaniesByIds(group.associatedCompanyIds);
  return { group, companies };
}

/**
 * Resolves US-qualification (Phase 7) for a batch of groups already on a
 * results page — fetches each group's associated companies' full records
 * (via the real association, deduplicated by Company Record ID across
 * groups per Phase 24/43) and evaluates the ALL-US rule per group.
 */
export async function qualifyGroupsForUs(groups: DealershipGroup[]): Promise<Map<string, QualificationResult>> {
  const allCompanyIds = Array.from(new Set(groups.flatMap((g) => g.associatedCompanyIds)));
  const companies = await getCompaniesByIds(allCompanyIds);
  const byId = new Map(companies.map((c) => [c.id, c]));
  const out = new Map<string, QualificationResult>();
  for (const g of groups) {
    const groupCompanies = g.associatedCompanyIds.map((id) => byId.get(id)).filter((c): c is Company => !!c);
    out.set(g.id, qualifyGroupForUsAssignment(groupCompanies));
  }
  return out;
}
