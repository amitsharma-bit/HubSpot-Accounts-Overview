import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { memberTotals } from "@/lib/aggregate";
import { parseFilterScope } from "@/lib/filters";

// See src/app/api/teams/route.ts — same reasoning.
export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get("team");
  const role = req.nextUrl.searchParams.get("role");
  const scope = parseFilterScope(req.nextUrl.searchParams);

  const ownerCounts = await getOwnerCounts(scope);
  let members = await memberTotals(ownerCounts);
  if (team) members = members.filter((m) => m.team === team);
  if (role) members = members.filter((m) => m.role === role);
  members.sort((a, b) => b.accountCount - a.accountCount);

  return NextResponse.json({ members });
}
