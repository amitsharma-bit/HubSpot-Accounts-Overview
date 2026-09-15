import { NextRequest, NextResponse } from "next/server";
import { performForcedRefresh } from "@/lib/forceRefresh";

// Vercel Hobby's Cron only allows daily schedules, not hourly (verified
// against Vercel's own docs) — the actual hourly trigger is a GitHub Actions
// workflow (.github/workflows/hourly-refresh.yml) hitting this route, not
// Vercel Cron. Protected by a shared secret so it can't be hit publicly to
// burn ~380 HubSpot API calls on demand. The dashboard's own "Refresh" button
// hits the separate, cooldown-protected /api/refresh-now instead — it can't
// use this secret (it isn't safe to ship to the browser).
export const maxDuration = 290;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await performForcedRefresh();
  return NextResponse.json({ ok: true, ...result });
}
