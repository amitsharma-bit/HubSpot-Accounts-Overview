import { searchCompanies, batchReadObjects, type SortSpec } from "../hubspot";
import { getOwnerToAssignment } from "../rosterStore";
import { countryFilter, dealershipClassFilters } from "../filters";
import { COMPANY_PROPERTIES, COMPANY_PROPERTY_LIST } from "./propertyMap";
import { classifyCompany, assignmentStatus } from "./eligibility";
import type { Company } from "./types";
import type { FilterGroup as HubspotFilterGroup } from "../types";

type RawRecord = { id: string; properties: Record<string, string | null> };

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Maps a raw HubSpot Company record into the canonical `Company` model,
 * resolving owner name/team from the SAME roster the rest of the app already
 * uses (no second owner system) and computing classification + assignment
 * status inline so every consumer sees the same values (Phase 40).
 */
export function mapCompanyRecord(raw: RawRecord, ownerMap: Map<number, { name: string; pod: string }>): Company {
  const p = raw.properties;
  const ownerId = num(p[COMPANY_PROPERTIES.ownerId]);
  const assignment = ownerId !== null ? ownerMap.get(ownerId) : undefined;
  const isPartOfGroupDealership = p[COMPANY_PROPERTIES.isPartOfGroupDealership] === "true" || p[COMPANY_PROPERTIES.isPartOfGroupDealership] === "Yes";
  const dealershipType = p[COMPANY_PROPERTIES.dealershipType] ?? null;
  const ownerAssignedDate = p[COMPANY_PROPERTIES.ownerAssignedDate] ?? null;

  const company: Company = {
    id: raw.id,
    recordId: raw.id,
    companyName: p[COMPANY_PROPERTIES.companyName] ?? null,
    domain: p[COMPANY_PROPERTIES.domain] ?? null,
    gdName: p[COMPANY_PROPERTIES.gdName] ?? null,
    gdRecordId: p[COMPANY_PROPERTIES.gdRecordId] ?? null,
    potentialRooftops: num(p[COMPANY_PROPERTIES.potentialRooftops]),
    lifecycleStage: p[COMPANY_PROPERTIES.lifecycleStage] ?? null,
    gdLevel: p[COMPANY_PROPERTIES.gdLevel] ?? null,
    companyOwner: assignment?.name ?? null,
    companyOwnerId: ownerId,
    ownerTeam: assignment?.pod ?? null,
    ownerAssignedDate,
    lastActivityDate: p[COMPANY_PROPERTIES.lastActivityDate] ?? null,
    associatedContacts: num(p[COMPANY_PROPERTIES.associatedContacts]),
    usedCars: num(p[COMPANY_PROPERTIES.usedCars]),
    newCars: num(p[COMPANY_PROPERTIES.newCars]),
    totalCars: num(p[COMPANY_PROPERTIES.totalCars]),
    gdCars: num(p[COMPANY_PROPERTIES.gdCars]),
    isPartOfGroupDealership,
    associatedDeals: num(p[COMPANY_PROPERTIES.associatedDeals]),
    websiteStatus: p[COMPANY_PROPERTIES.websiteStatus] ?? null,
    dealershipType,
    marketSegment: p[COMPANY_PROPERTIES.marketSegment] ?? null,
    city: p[COMPANY_PROPERTIES.city] ?? null,
    state: p[COMPANY_PROPERTIES.state] ?? null,
    county: null,
    country: p[COMPANY_PROPERTIES.country] ?? null,
    createdDate: p[COMPANY_PROPERTIES.createdDate] ?? null,
    lastModifiedDate: p[COMPANY_PROPERTIES.lastModifiedDate] ?? null,
    assignmentStatus: "UNASSIGNED", // set below, needs classification first only for logging clarity
    classification: classifyCompany({ isPartOfGroupDealership, dealershipType }),
  };
  company.assignmentStatus = assignmentStatus(ownerId, ownerAssignedDate);
  return company;
}

async function ownerLookup(): Promise<Map<number, { name: string; pod: string }>> {
  const raw = await getOwnerToAssignment();
  const out = new Map<number, { name: string; pod: string }>();
  for (const [ownerId, a] of raw) out.set(ownerId, { name: a.name, pod: a.pod });
  return out;
}

/**
 * SINGLE_FRANCHISE / INDEPENDENT_ROOFTOP pools are both company-scoped
 * (Phase 3B/3C) — same search shape, only the `dealershipClass` differs.
 * `notInGroup: true` is applied automatically since both pools are, by
 * definition, companies NOT part of a dealership group (see classifyCompany).
 */
export async function searchCompanyPool(input: {
  dealershipClass: "Franchise" | "Independent";
  country?: string;
  page: number;
  pageSize: number;
  sort?: SortSpec;
}): Promise<{ total: number; companies: Company[] }> {
  const filters: HubspotFilterGroup[] = [
    {
      filters: [countryFilter(input.country), ...dealershipClassFilters(input.dealershipClass)].slice(0, 6),
    },
  ];
  const [{ total, results }, ownerMap] = await Promise.all([
    searchCompanies(filters, input.page, COMPANY_PROPERTY_LIST, { pageSize: input.pageSize, sort: input.sort }),
    ownerLookup(),
  ]);
  return { total, companies: results.map((r) => mapCompanyRecord(r, ownerMap)) };
}

/** Fetches full Company records for a known list of IDs (e.g. a group's associated companies). */
export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  if (ids.length === 0) return [];
  const [raw, ownerMap] = await Promise.all([batchReadObjects("companies", ids, COMPANY_PROPERTY_LIST), ownerLookup()]);
  return raw.map((r) => mapCompanyRecord(r, ownerMap));
}
