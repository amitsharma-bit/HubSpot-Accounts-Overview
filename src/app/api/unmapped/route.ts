import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { systemBucketTotals, unmappedOwners } from "@/lib/aggregate";
import type { UnmappedResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
  const pageSize = Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") ?? "50"));

  const ownerCounts = await getOwnerCounts();
  const allUnmapped = await unmappedOwners(ownerCounts);
  const start = (page - 1) * pageSize;

  const body: UnmappedResponse = {
    systemBuckets: systemBucketTotals(ownerCounts),
    unmappedOwners: allUnmapped.slice(start, start + pageSize),
    unowned: { count: ownerCounts.unowned },
    page,
    pageSize,
    total: allUnmapped.length,
  };
  return NextResponse.json(body);
}
