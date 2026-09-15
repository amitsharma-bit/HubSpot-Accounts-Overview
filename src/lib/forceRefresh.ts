import { getOwnerCounts } from "./ownerCounts";
import { computeOverview } from "./overview";
import { recordDailySnapshotIfNeeded } from "./history";

/**
 * The one real "force a fresh sweep" implementation — shared by the hourly
 * cron's /api/refresh (secret-protected) and the dashboard's own manual
 * /api/refresh-now (cooldown-protected) button, so there's exactly one place
 * that does this ~380-call HubSpot sweep, not two copies that could drift.
 */
export async function performForcedRefresh(): Promise<{ computedAt: string; total: number }> {
  const result = await getOwnerCounts({}, true);
  const overview = await computeOverview({});
  // Best-effort — a history-write failure shouldn't fail the refresh itself,
  // since the live snapshot (what every page actually reads) already succeeded.
  await recordDailySnapshotIfNeeded(overview, result).catch((err) => console.error("[history]", err));
  return { computedAt: result.computedAt, total: result.total };
}
