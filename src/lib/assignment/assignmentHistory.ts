import { redis } from "../redis";
import type { AssignmentHistoryEntry, AssignmentPreview } from "./types";

/**
 * Records every SIMULATED preview a user ran, for future audit purposes
 * (Phase 32). A capped Redis list, newest first — this is a prototype
 * logging concern, not the live source of truth for anything the app reads
 * back to compute a number (that's always the fresh HubSpot data, per
 * Phase 39's "always perform a final fresh validation before mutation").
 * `mode` is hardcoded "SIMULATED" here — nothing in this file can ever write
 * "PRODUCTION"; that only becomes possible once a future HubSpotAssignmentService
 * exists (Phase 48), which this module does not implement.
 */
const HISTORY_KEY = "assignment:history:v1";
const HISTORY_MAX_ENTRIES = 500;

export async function recordSimulatedAssignment(
  preview: AssignmentPreview,
  selection: { selectedGroupIds: string[]; selectedCompanyIds: string[] },
  performedBy: string
): Promise<AssignmentHistoryEntry> {
  const entry: AssignmentHistoryEntry = {
    assignmentId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    performedBy,
    assignmentType: preview.assignmentType,
    selectedGroupIds: selection.selectedGroupIds,
    selectedCompanyIds: selection.selectedCompanyIds,
    affectedCompanyIds: preview.affectedCompanyIds,
    previousOwners: preview.currentOwnership.map((o) => ({ companyId: "", ownerId: o.ownerId, ownerName: o.ownerName })),
    newOwner: preview.target,
    numberAffected: preview.affectedCompanyCount,
    numberExcluded: preview.excludedCount,
    conflicts: preview.conflicts,
    status: "SIMULATED",
    mode: "SIMULATED",
  };
  await redis.lpush(HISTORY_KEY, JSON.stringify(entry));
  await redis.ltrim(HISTORY_KEY, 0, HISTORY_MAX_ENTRIES - 1);
  return entry;
}

export async function getAssignmentHistory(limit = 50): Promise<AssignmentHistoryEntry[]> {
  const raw = await redis.lrange(HISTORY_KEY, 0, limit - 1);
  return raw.map((v) => JSON.parse(v) as AssignmentHistoryEntry);
}
