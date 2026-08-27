import { NextResponse } from "next/server";
import { getOwnerCounts } from "@/lib/ownerCounts";

/**
 * Cheap and fast once a snapshot exists (Redis read only). maxDuration is set
 * generously anyway for the one-time edge case of an empty Redis store (a
 * brand-new deployment before the first /api/refresh run), where this falls
 * through to the full live sweep like any other default-scope caller.
 * Backs the "Refreshed <date>, <time> IST" indicator.
 */
export const maxDuration = 290;

export async function GET() {
  const result = await getOwnerCounts({});
  return NextResponse.json({ computedAt: result.computedAt });
}
