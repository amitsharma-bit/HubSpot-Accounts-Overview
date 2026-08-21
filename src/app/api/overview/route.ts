import { NextResponse } from "next/server";
import { countCompanies } from "@/lib/hubspot";
import { COUNTRY_FILTER, GROUP_DEALERSHIP_FILTER, GROUP_FLAG_FALSE } from "@/lib/filters";
import { cached } from "@/lib/cache";
import type { OverviewResponse } from "@/lib/types";

// Deliberately does NOT touch getOwnerCounts() (the ~75s cold aggregate) —
// every number here is one limit:1 search read as `total`, so this responds
// in a couple seconds even cold.
async function computeOverview(): Promise<OverviewResponse> {
  const [
    totalUsAccounts,
    franchise,
    independent,
    inGroupDealership,
    notInGroupDealership,
    groupFlagUnassigned,
    unownedUsAccounts,
    countryUnassignedTotal,
  ] = await Promise.all([
    countCompanies([{ filters: [COUNTRY_FILTER] }]),
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "type_of_dealership", operator: "EQ", value: "Franchise" }] }]),
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "type_of_dealership", operator: "EQ", value: "Independent" }] }]),
    countCompanies([{ filters: [COUNTRY_FILTER, GROUP_DEALERSHIP_FILTER] }]),
    countCompanies([
      { filters: [COUNTRY_FILTER, { propertyName: "is_this_is_a_part_of_group_dealership_", operator: "EQ", value: GROUP_FLAG_FALSE }] },
    ]),
    countCompanies([
      { filters: [COUNTRY_FILTER, { propertyName: "is_this_is_a_part_of_group_dealership_", operator: "NOT_HAS_PROPERTY" }] },
    ]),
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }]),
    countCompanies([{ filters: [{ propertyName: "country", operator: "NOT_HAS_PROPERTY" }] }]),
  ]);

  return {
    totalUsAccounts,
    franchise,
    independent,
    inGroupDealership,
    notInGroupDealership,
    groupFlagUnassigned,
    uniqueGroupDealerships: null, // deferred — see plan §8 tier 2, needs a full scan
    unownedUsAccounts,
    countryUnassignedTotal,
  };
}

export async function GET() {
  const data = await cached("overview", 30 * 60 * 1000, computeOverview);
  return NextResponse.json(data);
}
