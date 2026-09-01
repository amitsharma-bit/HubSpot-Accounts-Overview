import { NextRequest, NextResponse } from "next/server";
import { getStateBreakdown } from "@/lib/filterOptions";
import { parseFilterScope } from "@/lib/filters";

export const maxDuration = 290;

export async function GET(req: NextRequest) {
  const scope = parseFilterScope(req.nextUrl.searchParams);
  const states = await getStateBreakdown(scope);
  return NextResponse.json({ states });
}
