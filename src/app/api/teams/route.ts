import { NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { teamTotals, systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import type { TeamsResponse } from "@/lib/types";

export async function GET() {
  const ownerCounts = await getOwnerCounts();
  const unmapped = await unmappedOwners(ownerCounts);

  const body: TeamsResponse = {
    teams: teamTotals(ownerCounts),
    systemBuckets: systemBucketTotals(ownerCounts),
    unmapped: {
      count: unmapped.reduce((sum, o) => sum + o.count, 0),
      ownerCount: unmapped.length,
    },
    unowned: ownerCounts.unowned,
  };
  return NextResponse.json(body);
}
