import { NextRequest, NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";
import { computeOverview } from "@/lib/overview";
import { recordDailySnapshotIfNeeded } from "@/lib/history";

// Vercel Hobby's Cron only allows daily schedules, not hourly (verified
// against Vercel's own docs) — the actual hourly trigger is a GitHub Actions
// workflow (.github/workflows/hourly-refresh.yml) hitting this route, not
// Vercel Cron. Protected by a shared secret so it can't be hit publicly to
// burn ~380 HubSpot API calls on demand.
export const maxDuration = 290;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getOwnerCounts({}, true);
  const overview = await computeOverview({});
  // Best-effort — a history-write failure shouldn't fail the refresh itself,
  // since the live snapshot (what every page actually reads) already succeeded.
  await recordDailySnapshotIfNeeded(overview, result).catch((err) => console.error("[history]", err));

  return NextResponse.json({ ok: true, computedAt: result.computedAt, total: result.total });
}
