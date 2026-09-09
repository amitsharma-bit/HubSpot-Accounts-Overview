import { listOwners } from "../hubspot";
import { getCompaniesByIds } from "./companyService";
import { getGroupById } from "./groupService";
import { detectCompanyConflicts, detectGroupConflicts, detectDuplicateIds, detectTargetConflicts } from "./conflicts";
import { eligibleForAssignment } from "./eligibility";
import type { AssignmentSelection, AssignmentTarget, AssignmentPreview, Conflict, Company } from "./types";

/**
 * AssignmentPreviewService (Phase 28/48). SAFE BY CONSTRUCTION: this file
 * never imports anything from src/lib/hubspot.ts other than read-only calls
 * (listOwners, and via companyService/groupService: searchCompanies/
 * searchObjects/batchReadObjects/batchGetAssociations — all GET/search, no
 * PATCH/POST-to-a-CRM-object anywhere in this module). `status` is always
 * "SIMULATED". A future `HubSpotAssignmentService` (Phase 48) is the
 * intentional, separate, NOT-YET-BUILT boundary where a real PATCH would
 * eventually live, gated on this preview being explicitly approved.
 */

export class AssignmentPreviewService {
  static async preview(selection: AssignmentSelection, target: AssignmentTarget | null): Promise<AssignmentPreview> {
    const conflicts: Conflict[] = [];

    // Resolve every selected Group's associated companies (Phase 24/25) —
    // deduplicated by Company Record ID, including across overlapping groups.
    const groups = await Promise.all(selection.selectedGroupIds.map((id) => getGroupById(id)));
    const missingGroupIds = selection.selectedGroupIds.filter((_, i) => !groups[i]);
    for (const id of missingGroupIds) {
      conflicts.push({
        type: "MISSING_GROUP_RECORD_ID",
        severity: "BLOCKING",
        recordId: id,
        message: `Group ${id} could not be found in HubSpot.`,
        recommendedAction: "Remove this group from the selection.",
      });
    }

    const foundGroups = groups.filter((g): g is NonNullable<typeof g> => !!g);
    conflicts.push(...detectDuplicateIds(selection.selectedGroupIds, "DUPLICATE_GROUP_RECORD_ID"));

    const fromGroupsCompanyIds = foundGroups.flatMap((g) => g.associatedCompanyIds);
    const directCompanyIds = selection.selectedCompanyIds;
    // Dedupe by Record ID across BOTH the group-resolved set and any directly
    // selected companies (Phase 24: "never counted twice").
    const affectedCompanyIds = Array.from(new Set([...fromGroupsCompanyIds, ...directCompanyIds]));

    const companies = await getCompaniesByIds(affectedCompanyIds);
    const companyById = new Map(companies.map((c) => [c.id, c]));

    for (const group of foundGroups) {
      const groupCompanies = group.associatedCompanyIds.map((id) => companyById.get(id)).filter((c): c is Company => !!c);
      conflicts.push(...detectGroupConflicts(group, groupCompanies));
    }
    for (const company of companies) {
      conflicts.push(...detectCompanyConflicts(company, target));
    }
    conflicts.push(...detectDuplicateIds(affectedCompanyIds, "DUPLICATE_COMPANY_RECORD_ID"));

    const owners = await listOwners();
    const activeOwnerIds = new Set(owners.filter((o) => !o.archived).map((o) => o.ownerId));
    conflicts.push(...detectTargetConflicts(target, activeOwnerIds));

    const eligibleCompanyIds: string[] = [];
    const excludedCompanyIds: string[] = [];
    for (const company of companies) {
      const result = eligibleForAssignment(company);
      if (result.eligible) eligibleCompanyIds.push(company.id);
      else excludedCompanyIds.push(company.id);
    }

    const ownershipCounts = new Map<string, { ownerId: number | null; ownerName: string; count: number }>();
    for (const c of companies) {
      const key = c.companyOwnerId === null ? "unowned" : String(c.companyOwnerId);
      const entry = ownershipCounts.get(key) ?? { ownerId: c.companyOwnerId, ownerName: c.companyOwner ?? "Unowned", count: 0 };
      entry.count += 1;
      ownershipCounts.set(key, entry);
    }

    return {
      status: "SIMULATED",
      assignmentType: selection.assignmentType,
      target: target ?? { ownerId: -1, name: "(none selected)", role: "", team: "" },
      selectedGroupCount: selection.selectedGroupIds.length,
      selectedCompanyCount: selection.selectedCompanyIds.length,
      affectedCompanyIds,
      affectedCompanyCount: affectedCompanyIds.length,
      eligibleCompanyIds,
      eligibleCount: eligibleCompanyIds.length,
      excludedCompanyIds,
      excludedCount: excludedCompanyIds.length,
      currentOwnership: Array.from(ownershipCounts.values()),
      conflicts,
    };
  }
}
