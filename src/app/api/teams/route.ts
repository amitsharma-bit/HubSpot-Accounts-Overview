import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { teamTotals, systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import { parseFilterScope } from "@/lib/filters";
import type { TeamsResponse } from "@/lib/types";

// Default scope reads a warm Redis snapshot (fast); any other filter
// combination computes live (~75-300s, one count per HubSpot owner) — needs
// room to finish rather than hit Vercel's default 10s function timeout.
export const maxDuration = 290;

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
