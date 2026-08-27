import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, listOwners, PageBeyondLimitError } from "@/lib/hubspot";
import type { SortSpec } from "@/lib/hubspot";
import { buildFilterGroups, normalizeGroupFlag, classifyDealership, parseFilterScope, COUNTRY_PROPERTY, STATE_PROPERTY } from "@/lib/filters";
import { SYSTEM_OWNERS } from "@/config/roster";
import { getAssignments, getOwnerToAssignment } from "@/lib/rosterStore";
import { cached } from "@/lib/cache";
import type { AccountsResponse, CompanyRecord } from "@/lib/types";

const PROPERTIES = [
  "name",
  "domain",
  "city",
  STATE_PROPERTY,
  COUNTRY_PROPERTY,
  "hubspot_owner_id",
  "type_of_dealership",
  "gd_id",
  "gd_name",
  "is_this_is_a_part_of_group_dealership_",
  "potential_rooftops",
  "rooftop_last_activity",
  "hs_object_id",
];

const PAGE_SIZE = 25;

// Only real HubSpot properties can be sorted server-side, across the whole
// filtered dataset. "owner" (by name) and "team" aren't stored HubSpot
// properties — they're joined in from the roster — so they're sorted
// client-side, over whatever rows are already loaded, instead (see
// AccountsTable.tsx). Requesting one of those two here is a no-op.
const SERVER_SORT_PROPERTIES: Record<string, string> = {
  name: "name",
  domain: "domain",
  country: COUNTRY_PROPERTY,
  state: STATE_PROPERTY,
  city: "city",
  typeOfDealership: "type_of_dealership",
  gdName: "gd_name",
  potentialRooftops: "potential_rooftops",
  lastActivityDate: "rooftop_last_activity",
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const team = params.get("team") ?? undefined;
  const role = params.get("role") ?? undefined;
  const ownerIdParam = params.get("ownerId");
  const q = params.get("q") ?? undefined;
  const scope = parseFilterScope(params);

  const sortByParam = params.get("sortBy");
  const sortDirParam = params.get("sortDir") === "desc" ? "DESCENDING" : "ASCENDING";
  const sortProperty = sortByParam ? SERVER_SORT_PROPERTIES[sortByParam] : undefined;
  const sort: SortSpec | undefined = sortProperty ? { propertyName: sortProperty, direction: sortDirParam } : undefined;

  const [owners, assignments, ownerToAssignment] = await Promise.all([
    cached("owners-list", 24 * 60 * 60 * 1000, listOwners),
    getAssignments(),
    getOwnerToAssignment(),
  ]);
  const ownerNameById = new Map(owners.map((o) => [o.ownerId, o.name]));

  let ownerIds: number[] | undefined;
  if (ownerIdParam) {
    // Comma-separated: a merged roster entry (e.g. Dave/David Purgason) drills
    // into accounts owned by ANY of its owner IDs, not just the first.
    ownerIds = ownerIdParam.split(",").map(Number).filter((n) => !Number.isNaN(n));
  } else if (team || role) {
    ownerIds = assignments.filter((a) => (!team || a.pod === team) && (!role || a.role === role)).flatMap((a) => a.ownerIds);
  }

  const searchMatchedOwnerIds = q
    ? owners.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())).map((o) => o.ownerId)
    : undefined;

  const filterGroups = buildFilterGroups({
    country: scope.country,
    state: scope.state,
    city: scope.city,
    dealershipClass: scope.dealershipClass,
    ownerIds,
    searchTerm: q,
    searchMatchedOwnerIds,
  });

  let result;
  try {
    result = await searchCompanies(filterGroups, page, PROPERTIES, { pageSize: PAGE_SIZE, sort });
  } catch (err) {
    if (err instanceof PageBeyondLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const rows: CompanyRecord[] = result.results.map((r) => {
    const ownerId = r.properties.hubspot_owner_id ? Number(r.properties.hubspot_owner_id) : null;
    const assignment = ownerId ? ownerToAssignment.get(ownerId) : undefined;
    const ownerName = ownerId ? ownerNameById.get(ownerId) ?? SYSTEM_OWNERS[ownerId] ?? `Owner ${ownerId}` : null;
    const rooftops = r.properties.potential_rooftops ? Number(r.properties.potential_rooftops) : null;
    return {
      id: r.id,
      name: r.properties.name,
      domain: r.properties.domain,
      city: r.properties.city,
      state: r.properties[STATE_PROPERTY],
      country: r.properties[COUNTRY_PROPERTY],
      ownerId,
      ownerName,
      team: assignment?.pod ?? null,
      role: assignment?.role ?? null,
      typeOfDealership: r.properties.type_of_dealership,
      dealershipClass: classifyDealership(r.properties.type_of_dealership, r.properties.is_this_is_a_part_of_group_dealership_),
      gdId: r.properties.gd_id,
      gdName: r.properties.gd_name,
      inGroupDealership: normalizeGroupFlag(r.properties.is_this_is_a_part_of_group_dealership_),
      potentialRooftops: rooftops !== null && !Number.isNaN(rooftops) ? rooftops : null,
      lastActivityDate: r.properties.rooftop_last_activity,
    };
  });

  const pageCap = 400; // HubSpot's 10,000-row search ceiling / 25 per page
  const body: AccountsResponse = {
    rows,
    total: result.total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.min(pageCap, Math.ceil(result.total / PAGE_SIZE)),
    pageCap,
    cappedByHubSpot: result.total > 10_000,
  };
  return NextResponse.json(body);
}
