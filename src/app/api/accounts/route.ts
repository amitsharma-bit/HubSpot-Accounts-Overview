import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, listOwners, PageBeyondLimitError } from "@/lib/hubspot";
import { buildFilterGroups, normalizeGroupFlag } from "@/lib/filters";
import { OWNER_TO_MEMBER, ROSTER, SYSTEM_OWNERS } from "@/config/roster";
import { cached } from "@/lib/cache";
import type { AccountsResponse, CompanyRecord } from "@/lib/types";

const PROPERTIES = [
  "name",
  "domain",
  "city",
  "state",
  "country",
  "hubspot_owner_id",
  "type_of_dealership",
  "gd_id",
  "gd_name",
  "is_this_is_a_part_of_group_dealership_",
  "hs_object_id",
];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const team = params.get("team") ?? undefined;
  const role = params.get("role") ?? undefined;
  const ownerIdParam = params.get("ownerId");
  const city = params.get("city") ?? undefined;
  const state = params.get("state") ?? undefined;
  const typeOfDealership = params.get("typeOfDealership") ?? undefined;
  const q = params.get("q") ?? undefined;

  const owners = await cached("owners-list", 24 * 60 * 60 * 1000, listOwners);
  const ownerNameById = new Map(owners.map((o) => [o.ownerId, o.name]));

  let ownerIds: number[] | undefined;
  if (ownerIdParam) {
    // Comma-separated: a merged roster entry (e.g. Dave/David Purgason) drills
    // into accounts owned by ANY of its owner IDs, not just the first.
    ownerIds = ownerIdParam.split(",").map(Number).filter((n) => !Number.isNaN(n));
  } else if (team || role) {
    ownerIds = ROSTER.filter((m) => (!team || m.team === team) && (!role || m.role === role)).flatMap((m) => m.ownerIds);
  }

  const searchMatchedOwnerIds = q
    ? owners.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())).map((o) => o.ownerId)
    : undefined;

  const filterGroups = buildFilterGroups({
    ownerIds,
    city,
    state,
    typeOfDealership,
    searchTerm: q,
    searchMatchedOwnerIds,
  });

  let result;
  try {
    result = await searchCompanies(filterGroups, page, PROPERTIES);
  } catch (err) {
    if (err instanceof PageBeyondLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const rows: CompanyRecord[] = result.results.map((r) => {
    const ownerId = r.properties.hubspot_owner_id ? Number(r.properties.hubspot_owner_id) : null;
    const member = ownerId ? OWNER_TO_MEMBER.get(ownerId) : undefined;
    const ownerName = ownerId ? ownerNameById.get(ownerId) ?? SYSTEM_OWNERS[ownerId] ?? `Owner ${ownerId}` : null;
    return {
      id: r.id,
      name: r.properties.name,
      domain: r.properties.domain,
      city: r.properties.city,
      state: r.properties.state,
      country: r.properties.country,
      ownerId,
      ownerName,
      team: member?.team ?? null,
      role: member?.role ?? null,
      typeOfDealership: r.properties.type_of_dealership,
      gdId: r.properties.gd_id,
      gdName: r.properties.gd_name,
      inGroupDealership: normalizeGroupFlag(r.properties.is_this_is_a_part_of_group_dealership_),
    };
  });

  const pageCap = 100;
  const body: AccountsResponse = {
    rows,
    total: result.total,
    page,
    pageSize: 100,
    totalPages: Math.min(pageCap, Math.ceil(result.total / 100)),
    pageCap,
    cappedByHubSpot: result.total > 10_000,
  };
  return NextResponse.json(body);
}
