import { SYSTEM_OWNERS } from "@/config/roster";
import type { Company, DealershipGroup, Classification, QualificationResult, AssignmentStatus } from "./types";

/**
 * Configurable thresholds (Phase 16) — kept in one place, not buried inside
 * assignment-status logic, so they can be tuned without hunting for magic
 * numbers.
 */
export const ASSIGNMENT_STATUS_THRESHOLDS = {
  recentlyAssignedWithinDays: 7,
  staleAssignmentAfterDays: 90,
};

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

/**
 * Classification (Phase 47): every company lands in exactly one pool, or
 * UNCLASSIFIED with a stated reason — never guessed, never allowed into two
 * pools at once. DEALERSHIP_GROUP takes priority (a company that's part of a
 * group is reached via the group's selection, not as a standalone Single
 * Franchise / Independent Rooftop pick), then the native Franchise/
 * Independent split decides the other two pools.
 */
export function classifyCompany(c: Pick<Company, "isPartOfGroupDealership" | "dealershipType">): Classification {
  if (c.isPartOfGroupDealership) {
    return { pool: "DEALERSHIP_GROUP", reason: "is_this_is_a_part_of_group_dealership_ = true" };
  }
  if (c.dealershipType === "Franchise") {
    return { pool: "SINGLE_FRANCHISE", reason: "type_of_dealership = Franchise, not part of a group" };
  }
  if (c.dealershipType === "Independent") {
    return { pool: "INDEPENDENT_ROOFTOP", reason: "type_of_dealership = Independent, not part of a group" };
  }
  return { pool: "UNCLASSIFIED", reason: `type_of_dealership is "${c.dealershipType ?? "null"}" — neither Franchise nor Independent, and not part of a group` };
}

/**
 * SalesOps eligibility (Phase 6). Uses the SAME canonical SYSTEM_OWNERS
 * identifier the rest of this app already treats as "SalesOps" (the
 * `salesops .` bulk-import owner), not a display-text guess.
 */
const SALESOPS_OWNER_IDS = new Set(Object.keys(SYSTEM_OWNERS).map(Number));

export function isSalesOpsOwned(ownerId: number | null): boolean {
  return ownerId !== null && SALESOPS_OWNER_IDS.has(ownerId);
}

export type EligibilityConfig = {
  requireUsCountry: boolean;
};

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = { requireUsCountry: true };

/**
 * eligibleForAssignment(record) (Phase 6): the default rule. Country=US
 * where applicable, a valid record ID, not a deleted/merged record, and not
 * excluded by the record's own classification being UNCLASSIFIED.
 */
export function eligibleForAssignment(c: Company, config: EligibilityConfig = DEFAULT_ELIGIBILITY_CONFIG): QualificationResult {
  const reasons: string[] = [];
  if (!c.id) reasons.push("MISSING_COMPANY_RECORD_ID");
  if (config.requireUsCountry && c.country !== "United States") reasons.push("NON_US_COMPANY");
  if (c.classification.pool === "UNCLASSIFIED") reasons.push("UNCLASSIFIED_COMPANY");
  return { eligible: reasons.length === 0, reasons };
}

export function assignmentStatus(ownerId: number | null, ownerAssignedDate: string | null): AssignmentStatus {
  if (ownerId === null) return "UNASSIGNED";
  if (isSalesOpsOwned(ownerId)) return "UNASSIGNED"; // SalesOps-held == not yet assigned to a rep, per Phase 15/16
  const age = daysAgo(ownerAssignedDate);
  if (age === null) return "ASSIGNED";
  if (age <= ASSIGNMENT_STATUS_THRESHOLDS.recentlyAssignedWithinDays) return "RECENTLY_ASSIGNED";
  if (age > ASSIGNMENT_STATUS_THRESHOLDS.staleAssignmentAfterDays) return "STALE_ASSIGNMENT";
  return "ASSIGNED";
}

/**
 * Phase 7 — Group country qualification. The Group object has NO native
 * geography property (confirmed live), so this is the entire definition of
 * "is this group US-eligible": ALL of its associated companies must be
 * United States. Returns a structured result with reasons, never a bare
 * boolean (Phase 23).
 */
export function qualifyGroupForUsAssignment(companies: Pick<Company, "country" | "id">[]): QualificationResult {
  const reasons: string[] = [];
  if (companies.length === 0) reasons.push("GROUP_NO_ASSOCIATED_COMPANIES");
  const nonUs = companies.filter((c) => c.country !== "United States");
  if (nonUs.length > 0) reasons.push("NON_US_ASSOCIATED_COMPANY");
  return { eligible: reasons.length === 0, reasons };
}

/**
 * General-purpose rooftop aggregation (Phase 11/18) — ANY / ALL / NONE /
 * AT_LEAST / AT_MOST / EXACTLY over a per-company predicate. Shared by the
 * filter engine's AGGREGATED_ROOFTOPS scope and by group qualification.
 */
export type RooftopAggregationMode = "ANY" | "ALL" | "NONE" | "AT_LEAST" | "AT_MOST" | "EXACTLY";

export function evaluateRooftopAggregation<T>(items: T[], predicate: (item: T) => boolean, mode: RooftopAggregationMode, count?: number): boolean {
  const matching = items.filter(predicate).length;
  switch (mode) {
    case "ANY":
      return matching > 0;
    case "ALL":
      return items.length > 0 && matching === items.length;
    case "NONE":
      return matching === 0;
    case "AT_LEAST":
      return matching >= (count ?? 0);
    case "AT_MOST":
      return matching <= (count ?? Infinity);
    case "EXACTLY":
      return matching === (count ?? -1);
  }
}

/**
 * Full Group qualification (Phase 23): composes the US rule with whatever
 * additional business filters the caller wants evaluated (e.g. Potential
 * Rooftops >= 5, GD Stage = Prospect), producing one structured result.
 */
export function qualifyGroup(
  group: Pick<DealershipGroup, "associatedCompanyCount">,
  companies: Pick<Company, "country" | "id">[],
  extraChecks: { pass: boolean; reason: string }[] = []
): QualificationResult {
  const us = qualifyGroupForUsAssignment(companies);
  const reasons = [...us.reasons];
  for (const check of extraChecks) if (!check.pass) reasons.push(check.reason);
  return { eligible: reasons.length === 0, reasons };
}
