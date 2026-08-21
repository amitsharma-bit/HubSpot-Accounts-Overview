import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { memberTotals } from "@/lib/aggregate";

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get("team");
  const role = req.nextUrl.searchParams.get("role");

  const ownerCounts = await getOwnerCounts();
  let members = memberTotals(ownerCounts);
  if (team) members = members.filter((m) => m.team === team);
  if (role) members = members.filter((m) => m.role === role);
  members.sort((a, b) => b.accountCount - a.accountCount);

  return NextResponse.json({ members });
}
