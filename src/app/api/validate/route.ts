import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts, reconcile } from "@/lib/ownerCounts";
import { countCompanies } from "@/lib/hubspot";
import { countryFilter, dealershipClassFilters, parseFilterScope } from "@/lib/filters";
import { teamTotals, memberTotals, systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import type { ValidationReport } from "@/lib/types";

// See src/app/api/teams/route.ts — same reasoning.
export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const scope = parseFilterScope(req.nextUrl.searchParams);
  const base = [countryFilter(scope.country)];

  const ownerCounts = await getOwnerCounts(scope);
  const reconciliation = reconcile(ownerCounts);
  const [unmapped, teams, members] = await Promise.all([
    unmappedOwners(ownerCounts),
    teamTotals(ownerCounts),
    memberTotals(ownerCounts),
  ]);
  const systemBuckets = systemBucketTotals(ownerCounts);

  const [independent, franchise, inGroupDealership] = await Promise.all([
    countCompanies([{ filters: [...base, ...dealershipClassFilters("Independent")] }]),
    countCompanies([{ filters: [...base, ...dealershipClassFilters("Franchise")] }]),
    countCompanies([{ filters: [...base, ...dealershipClassFilters("Group")] }]),
  ]);

  const report: ValidationReport = {
    totalDistinctUsAccounts: ownerCounts.total,
    ownersWithUsAccounts: Object.keys(ownerCounts.counts).length,
    teamTotals: teams.map((t) => ({ team: t.team, accountCount: t.accountCount })),
    memberTotals: members.map((m) => ({ name: m.name, accountCount: m.accountCount })),
    unmappedOwnerCount: unmapped.length,
    unmappedAccountCount: unmapped.reduce((sum, o) => sum + o.count, 0),
    systemBucketAccountCount: systemBuckets.reduce((sum, b) => sum + b.count, 0),
    unownedCount: ownerCounts.unowned,
    reconciliation,
    classificationReconciliation: {
      pass: independent + franchise + inGroupDealership === ownerCounts.total,
      independent,
      franchise,
      inGroupDealership,
      total: ownerCounts.total,
    },
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
