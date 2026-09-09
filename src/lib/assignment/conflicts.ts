import { isSalesOpsOwned } from "./eligibility";
import type { Company, DealershipGroup, Conflict, AssignmentTarget } from "./types";

/**
 * Conflict detection (Phase 29). Each function returns zero or more
 * Conflicts for one record — the caller (assignmentPreview.ts) concatenates
 * them across the whole selection. Severity: BLOCKING conflicts should stop
 * a future real mutation; WARNING ones are informational (Phase 30 — never
 * silently override an existing non-SalesOps owner without surfacing it).
 */

export function detectCompanyConflicts(c: Company, target: AssignmentTarget | null): Conflict[] {
  const out: Conflict[] = [];

  if (!c.id) {
    out.push({
      type: "MISSING_COMPANY_RECORD_ID",
      severity: "BLOCKING",
      recordId: c.id ?? "unknown",
      message: "Company is missing a HubSpot Record ID.",
      recommendedAction: "Exclude this record from the assignment.",
    });
    return out; // nothing else is trustworthy without a real ID
  }

  if (c.country !== "United States") {
    out.push({
      type: "NON_US_COMPANY",
      severity: "BLOCKING",
      recordId: c.id,
      message: `${c.companyName ?? c.id} is not a US record (country: ${c.country ?? "unknown"}).`,
      recommendedAction: "Exclude from a US-only assignment run.",
    });
  }

  if (c.companyOwnerId !== null && !isSalesOpsOwned(c.companyOwnerId) && target && c.companyOwnerId !== target.ownerId) {
    out.push({
      type: "ALREADY_ASSIGNED_TO_OTHER_OWNER",
      severity: "WARNING",
      recordId: c.id,
      message: `${c.companyName ?? c.id} is currently owned by ${c.companyOwner ?? c.companyOwnerId}, not SalesOps.`,
      recommendedAction: "Confirm this reassignment is intentional before ever applying it for real.",
    });
  }

  if (c.classification.pool === "UNCLASSIFIED") {
    out.push({
      type: "MISSING_REQUIRED_PROPERTY",
      severity: "WARNING",
      recordId: c.id,
      message: `${c.companyName ?? c.id} could not be classified: ${c.classification.reason}`,
      recommendedAction: "Confirm type_of_dealership / group-dealership flag are populated for this record.",
    });
  }

  return out;
}

export function detectGroupConflicts(group: DealershipGroup, companies: Company[]): Conflict[] {
  const out: Conflict[] = [];

  if (!group.id) {
    out.push({
      type: "MISSING_GROUP_RECORD_ID",
      severity: "BLOCKING",
      recordId: group.id ?? "unknown",
      message: "Dealership Group is missing a HubSpot Record ID.",
      recommendedAction: "Exclude this group from the assignment.",
    });
    return out;
  }

  if (companies.length === 0) {
    out.push({
      type: "GROUP_NO_ASSOCIATED_COMPANIES",
      severity: "BLOCKING",
      recordId: group.id,
      message: `${group.groupName ?? group.id} has no associated companies via the real HubSpot association.`,
      recommendedAction: "Verify the association in HubSpot before assigning this group.",
    });
  }

  const nonUs = companies.filter((c) => c.country !== "United States");
  if (nonUs.length > 0) {
    out.push({
      type: "GROUP_NON_US_ROOFTOP",
      severity: "BLOCKING",
      recordId: group.id,
      message: `${group.groupName ?? group.id} has ${nonUs.length} non-US associated compan${nonUs.length === 1 ? "y" : "ies"} (${nonUs.map((c) => c.companyName ?? c.id).join(", ")}).`,
      recommendedAction: "Exclude this group from a US-only assignment run, or exclude just the non-US companies.",
    });
  }

  const distinctOwners = new Set(companies.map((c) => c.companyOwnerId).filter((id): id is number => id !== null && !isSalesOpsOwned(id)));
  if (distinctOwners.size > 1 || (distinctOwners.size === 1 && companies.some((c) => c.companyOwnerId === null || isSalesOpsOwned(c.companyOwnerId)))) {
    out.push({
      type: "GROUP_MIXED_OWNERS",
      severity: "WARNING",
      recordId: group.id,
      message: `${group.groupName ?? group.id}'s associated companies are not uniformly owned — some are SalesOps-held or unowned, others already have a named owner.`,
      recommendedAction: "Review each associated company's current owner in the preview before proceeding.",
    });
  }

  return out;
}

/** Duplicate-ID detection across a whole selection (Phase 29/43) — dedupe by Record ID, never by name. */
export function detectDuplicateIds(ids: string[], type: "DUPLICATE_COMPANY_RECORD_ID" | "DUPLICATE_GROUP_RECORD_ID"): Conflict[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return Array.from(dupes).map((id) => ({
    type,
    severity: "WARNING" as const,
    recordId: id,
    message: `Record ID ${id} appeared more than once in the selection.`,
    recommendedAction: "Already deduplicated in the preview — no action needed.",
  }));
}

export function detectTargetConflicts(target: AssignmentTarget | null, activeOwnerIds: Set<number>): Conflict[] {
  if (!target) {
    return [
      {
        type: "TARGET_OWNER_NOT_FOUND",
        severity: "BLOCKING",
        recordId: "target",
        message: "No assignment target selected.",
        recommendedAction: "Pick a target from the configured sales roster before previewing.",
      },
    ];
  }
  if (!activeOwnerIds.has(target.ownerId)) {
    return [
      {
        type: "TARGET_OWNER_INACTIVE",
        severity: "BLOCKING",
        recordId: String(target.ownerId),
        message: `${target.name} is not an active HubSpot owner.`,
        recommendedAction: "Choose a different, active target owner.",
      },
    ];
  }
  return [];
}
