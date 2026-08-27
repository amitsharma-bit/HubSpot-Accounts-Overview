import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { teamTotals, systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import { parseFilterScope } from "@/lib/filters";
import type { TeamsResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const scope = parseFilterScope(req.nextUrl.searchParams);
  const ownerCounts = await getOwnerCounts(scope);
  const [teams, unmapped] = await Promise.all([teamTotals(ownerCounts), unmappedOwners(ownerCounts)]);

  const body: TeamsResponse = {
    teams,
    systemBuckets: systemBucketTotals(ownerCounts),
    unmapped: {
      count: unmapped.reduce((sum, o) => sum + o.count, 0),
      ownerCount: unmapped.length,
    },
    unowned: ownerCounts.unowned,
  };
  return NextResponse.json(body);
}
