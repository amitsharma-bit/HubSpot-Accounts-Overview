import { NextRequest, NextResponse } from "next/server";
import { parseFilterScope, scopeCacheKey, isDefaultScope } from "@/lib/filters";
import { computeOverview } from "@/lib/overview";
import { getOverviewHistory } from "@/lib/history";
import { cached } from "@/lib/cache";
import type { OverviewResponse } from "@/lib/types";

const HISTORY_DAYS = 90;

export async function GET(req: NextRequest) {
  const scope = parseFilterScope(req.nextUrl.searchParams);
  const data = await cached(`overview:${scopeCacheKey(scope)}`, 30 * 60 * 1000, () => computeOverview(scope));

  // Sparklines/deltas only make sense against the one scope the daily
  // history job actually records — see history.ts. This route is
  // deliberately kept independent of Redis being reachable (unlike
  // getOwnerCounts()), so a history-read failure just means no sparklines,
  // never a failed overview response.
  let history: OverviewResponse["history"];
  if (isDefaultScope(scope)) {
    try {
      const points = await cached("overview-history", 30 * 60 * 1000, () => getOverviewHistory(HISTORY_DAYS));
      if (points.length > 0) history = points;
    } catch (err) {
      console.error("overview history unavailable:", err);
    }
  }

  return NextResponse.json({ ...data, history });
}
