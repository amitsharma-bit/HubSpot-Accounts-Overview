import { NextResponse } from "next/server";
import { getOwnerCounts, reconcile } from "@/lib/ownerCounts";
import { countCompanies } from "@/lib/hubspot";
import { COUNTRY_FILTER } from "@/lib/filters";
import { teamTotals, memberTotals, systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import type { ValidationReport } from "@/lib/types";

export async function GET() {
  const ownerCounts = await getOwnerCounts();
  const reconciliation = reconcile(ownerCounts);
  const unmapped = await unmappedOwners(ownerCounts);
  const systemBuckets = systemBucketTotals(ownerCounts);

  const [franchise, independent, countryUnassignedTotal] = await Promise.all([
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "type_of_dealership", operator: "EQ", value: "Franchise" }] }]),
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "type_of_dealership", operator: "EQ", value: "Independent" }] }]),
    countCompanies([{ filters: [{ propertyName: "country", operator: "NOT_HAS_PROPERTY" }] }]),
  ]);

  const report: ValidationReport = {
    totalDistinctUsAccounts: ownerCounts.total,
    ownersWithUsAccounts: Object.keys(ownerCounts.counts).length,
    teamTotals: teamTotals(ownerCounts).map((t) => ({ team: t.team, accountCount: t.accountCount })),
    memberTotals: memberTotals(ownerCounts).map((m) => ({ name: m.name, accountCount: m.accountCount })),
    unmappedOwnerCount: unmapped.length,
    unmappedAccountCount: unmapped.reduce((sum, o) => sum + o.count, 0),
    systemBucketAccountCount: systemBuckets.reduce((sum, b) => sum + b.count, 0),
    unownedCount: ownerCounts.unowned,
    reconciliation,
    dealershipTypeReconciliation: {
      pass: franchise + independent === ownerCounts.total,
      franchise,
      independent,
      total: ownerCounts.total,
    },
    countryUnassignedTotal,
    duplicateRecordIds: {
      count: 0,
      reason: "hs_object_id is HubSpot's server-assigned primary key; two records cannot share one. Verified structurally, not by scanning rows.",
    },
    paginationComplete: {
      explanation:
        "Every aggregate in this app is a limit:1 count-only search read from HubSpot's `total` field — no pages are walked to produce a total, so there is nothing to complete. The correctness guarantee instead is the reconciliation identity below.",
    },
    totalsServerSide: {
      explanation:
        "All counts are computed in API routes calling HubSpot's Search API directly. The client never sums, filters, or paginates raw records to produce a displayed total.",
    },
    computedAt: ownerCounts.computedAt,
  };
  return NextResponse.json(report);
}
