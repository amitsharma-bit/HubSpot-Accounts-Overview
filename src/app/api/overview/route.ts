import { NextRequest, NextResponse } from "next/server";
import { countCompanies, listOwners } from "@/lib/hubspot";
import { countryFilter, dealershipClassFilters, STATE_PROPERTY, parseFilterScope, scopeCacheKey } from "@/lib/filters";
import { SYSTEM_OWNERS } from "@/config/roster";
import { cached } from "@/lib/cache";
import type { OverviewResponse, FilterScope, PropertyFilter } from "@/lib/types";

function scopeFilters(scope: FilterScope): PropertyFilter[] {
  const filters: PropertyFilter[] = [countryFilter(scope.country)];
  if (scope.state) filters.push({ propertyName: STATE_PROPERTY, operator: "EQ", value: scope.state });
  if (scope.city) filters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: scope.city });
  if (scope.dealershipClass) filters.push(...dealershipClassFilters(scope.dealershipClass));
  return filters;
}

// Deliberately does NOT touch getOwnerCounts() (the ~75s cold per-owner
// aggregate) — every number here is one limit:1 search read as `total`, so
// this responds in a couple seconds even cold.
async function computeOverview(scope: FilterScope): Promise<OverviewResponse> {
  const base = scopeFilters(scope);
  // If the sidebar already narrowed to one classification, the other two
  // counts are trivially zero — no need to query them.
  const want = (cls: "Independent" | "Franchise" | "Group") => !scope.dealershipClass || scope.dealershipClass === cls;

  const systemOwnerIds = Object.keys(SYSTEM_OWNERS).map(Number);

  const [totalUsAccounts, independent, franchise, inGroupDealership, owners, ...salesOpsCounts] = await Promise.all([
    countCompanies([{ filters: base }]),
    want("Independent") ? countCompanies([{ filters: [...base, ...dealershipClassFilters("Independent")] }]) : Promise.resolve(0),
    want("Franchise") ? countCompanies([{ filters: [...base, ...dealershipClassFilters("Franchise")] }]) : Promise.resolve(0),
    want("Group") ? countCompanies([{ filters: [...base, ...dealershipClassFilters("Group")] }]) : Promise.resolve(0),
    listOwners(),
    ...systemOwnerIds.map((id) =>
      countCompanies([{ filters: [...base, { propertyName: "hubspot_owner_id", operator: "EQ", value: String(id) }] }])
    ),
  ]);

  const ownerNameById = new Map(owners.map((o) => [o.ownerId, o.name]));
  const salesOpsOwners = systemOwnerIds.map((id, i) => ({
    ownerId: id,
    name: ownerNameById.get(id) ?? SYSTEM_OWNERS[id],
    count: salesOpsCounts[i],
  }));

  return {
    totalUsAccounts,
    independent,
    franchise,
    inGroupDealership,
    salesOps: {
      accounts: salesOpsOwners.reduce((sum, o) => sum + o.count, 0),
      owners: salesOpsOwners.filter((o) => o.count > 0).map((o) => ({ ownerId: o.ownerId, name: o.name })),
    },
  };
}

export async function GET(req: NextRequest) {
  const scope = parseFilterScope(req.nextUrl.searchParams);
  const data = await cached(`overview:${scopeCacheKey(scope)}`, 30 * 60 * 1000, () => computeOverview(scope));
  return NextResponse.json(data);
}
