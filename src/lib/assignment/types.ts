/**
 * Canonical data-assignment models. Centralized here on purpose (per spec) —
 * nothing in this module scatters its own ad hoc shapes in components.
 *
 * SAFETY: this whole module is DRY-RUN only. Nothing in here calls a HubSpot
 * write/mutation endpoint. `AssignmentPreview`/`AssignmentHistoryEntry.mode`
 * is always "SIMULATED" for now — see src/lib/assignment/assignmentPreview.ts.
 */

// ---------------------------------------------------------------------------
// Assignment pools / classification
// ---------------------------------------------------------------------------

export type AssignmentType = "DEALERSHIP_GROUP" | "SINGLE_FRANCHISE" | "INDEPENDENT_ROOFTOP";

/** A company can appear in exactly one pool, or none (UNCLASSIFIED, with a reason — never guessed). */
export type Classification =
  | { pool: "DEALERSHIP_GROUP"; reason: string }
  | { pool: "SINGLE_FRANCHISE"; reason: string }
  | { pool: "INDEPENDENT_ROOFTOP"; reason: string }
  | { pool: "UNCLASSIFIED"; reason: string };

export type AssignmentStatus = "UNASSIGNED" | "ASSIGNED" | "RECENTLY_ASSIGNED" | "STALE_ASSIGNMENT" | "NOT_ELIGIBLE";

// ---------------------------------------------------------------------------
// Dealership Group (backed by the real p242626590_dealship_group_names object
// + its real association to Company — see src/lib/assignment/propertyMap.ts)
// ---------------------------------------------------------------------------

export type DealershipGroup = {
  id: string; // HubSpot record ID of the Group object — canonical identifier
  groupName: string | null;
  recordId: string; // same as id, kept as a named field per spec's model list
  owner: string | null; // resolved name, if the owner ID matches a real HubSpot owner
  ownerId: number | null;
  ownerTeam: string | null; // resolved from the existing roster (src/config/roster.ts), if the owner is on it
  ownerAssignedDate: string | null;
  dealershipRank: string | null; // often null — not populated on every record, don't assume
  potentialRooftops: number | null; // NOT FOUND on the Group object as of this build — see KNOWN_GAPS in propertyMap.ts
  actualRooftops: number | null; // the `rooftops` rollup — count of really-associated companies
  gdStage: string | null;
  gdTier: string | null; // extra real property found (`gd_tier`) beyond the requested model — kept since it's real data
  gdLastActivity: string | null;
  gdCreatedDate: string | null;
  gdLastModifiedDate: string | null;
  currentStatus: string | null;
  // Geography is NOT a native property on the Group object (confirmed live) — always null here.
  // Use `deriveGroupGeography()` in eligibility.ts to reason about US-qualification from
  // associated companies instead, per Phase 7's aggregation rule.
  country: null;
  state: null;
  city: null;
  county: null;
  associatedCompanyIds: string[]; // resolved via the real association (type 17), not gd_id matching
  associatedCompanyCount: number;
  contactsCount: number | null; // NOT FOUND on the Group object as of this build — see KNOWN_GAPS
  usedCars: number | null; // `used_cars__gd_` rollup
  newCars: number | null; // `new_cars__gd_` rollup
  totalCars: number | null; // `number_of_cars__gd_level_`
  marketSegment: string | null; // NOT FOUND on the Group object as of this build — see KNOWN_GAPS
};

// ---------------------------------------------------------------------------
// Company / Rooftop
// ---------------------------------------------------------------------------

export type Company = {
  id: string;
  recordId: string;
  companyName: string | null;
  domain: string | null;
  gdName: string | null;
  gdRecordId: string | null; // == gd_id; verified to match the real Group association target
  potentialRooftops: number | null;
  lifecycleStage: string | null;
  gdLevel: string | null;
  companyOwner: string | null;
  companyOwnerId: number | null;
  ownerTeam: string | null;
  ownerAssignedDate: string | null;
  lastActivityDate: string | null; // rooftop_last_activity — deliberately NOT the same as GD Last Activity (Phase 14)
  associatedContacts: number | null;
  usedCars: number | null;
  newCars: number | null;
  totalCars: number | null;
  gdCars: number | null; // number_of_cars__gd_level_ — also present on Company, not just Group
  isPartOfGroupDealership: boolean;
  associatedDeals: number | null; // count only (num_associated_deals) — not full deal records
  websiteStatus: string | null;
  dealershipType: string | null; // Franchise / Independent (native, 2 values)
  marketSegment: string | null; // synced by an EXTERNAL system (market_segment's own HubSpot description
  // says "computed by the TAM dashboard sync (segment.ts)") — read-only here, never computed by us.
  city: string | null;
  state: string | null;
  county: null; // does not exist on this portal — confirmed, never invent it
  country: string | null;
  createdDate: string | null;
  lastModifiedDate: string | null;
  assignmentStatus: AssignmentStatus;
  classification: Classification;
};

// ---------------------------------------------------------------------------
// Team / SalesMember (thin views over the EXISTING roster — not a new system)
// ---------------------------------------------------------------------------

export type Team = { name: string; memberCount: number };

export type SalesMember = {
  ownerIds: number[]; // merged owner IDs, same shape as the existing roster's MemberTotal
  name: string;
  role: string;
  team: string;
  status: "ACTIVE" | "INACTIVE" | "UNKNOWN";
};

// ---------------------------------------------------------------------------
// Filter engine — structured, not string-parsed (Phase 17)
// ---------------------------------------------------------------------------

export type FilterFieldType = "TEXT" | "NUMBER" | "DATE" | "ENUM" | "BOOLEAN";

export type FilterScopeKind = "GROUP" | "COMPANY" | "ROOFTOP" | "AGGREGATED_ROOFTOPS";

export type TextOperator = "equals" | "notEquals" | "contains" | "notContains" | "startsWith" | "endsWith" | "isKnown" | "isUnknown";
export type NumberOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "between"
  | "notBetween"
  | "isKnown"
  | "isUnknown";
export type DateOperator =
  | "equals"
  | "before"
  | "after"
  | "between"
  | "withinLast"
  | "withinNext"
  | "olderThan"
  | "newerThan"
  | "isKnown"
  | "isUnknown";
export type EnumOperator = "equals" | "notEquals" | "isAnyOf" | "isNoneOf" | "isKnown" | "isUnknown";
export type BooleanOperator = "isTrue" | "isFalse" | "isKnown" | "isUnknown";
export type FilterOperator = TextOperator | NumberOperator | DateOperator | EnumOperator | BooleanOperator;

/** ANY/ALL/NONE/AT_LEAST/AT_MOST/EXACTLY — only meaningful when scope is AGGREGATED_ROOFTOPS. */
export type RooftopAggregation = "ANY" | "ALL" | "NONE" | "AT_LEAST" | "AT_MOST" | "EXACTLY";

export type FilterDefinition = {
  field: string; // a canonical model field name, e.g. "potentialRooftops", "country" — resolved via propertyMap.ts
  scope: FilterScopeKind;
  fieldType: FilterFieldType;
  operator: FilterOperator;
  value?: string | number | boolean;
  values?: (string | number)[]; // for isAnyOf/isNoneOf/IN-style operators
  secondValue?: string | number; // for between/notBetween
  /** Required when scope === "AGGREGATED_ROOFTOPS" (Phase 11/18). */
  aggregation?: RooftopAggregation;
  /** The threshold for AT_LEAST/AT_MOST/EXACTLY. */
  aggregationCount?: number;
};

export type LogicalOperator = "AND" | "OR" | "NOT";

/** Nested filter-group AST — a group is either a leaf FilterDefinition or a node combining child groups. */
export type FilterGroup =
  | { kind: "leaf"; filter: FilterDefinition }
  | { kind: "node"; operator: LogicalOperator; children: FilterGroup[] };

// ---------------------------------------------------------------------------
// Eligibility / qualification
// ---------------------------------------------------------------------------

export type QualificationResult = {
  eligible: boolean;
  reasons: string[]; // failure reason codes, e.g. "NON_US_ASSOCIATED_COMPANY" — empty when eligible
};

// ---------------------------------------------------------------------------
// Selection / preview / conflicts (dry-run only)
// ---------------------------------------------------------------------------

export type AssignmentSelection = {
  assignmentType: AssignmentType;
  selectedGroupIds: string[];
  selectedCompanyIds: string[]; // for SINGLE_FRANCHISE / INDEPENDENT_ROOFTOP, or explicitly-excluded IDs within a group
};

export type ConflictType =
  | "NON_US_COMPANY"
  | "ALREADY_ASSIGNED_TO_OTHER_OWNER"
  | "GROUP_MIXED_OWNERS"
  | "GROUP_NON_US_ROOFTOP"
  | "GROUP_NO_ASSOCIATED_COMPANIES"
  | "MISSING_COMPANY_RECORD_ID"
  | "MISSING_GROUP_RECORD_ID"
  | "DELETED_OR_MERGED_RECORD"
  | "INELIGIBLE_SALESOPS_STATUS"
  | "TARGET_OWNER_INACTIVE"
  | "TARGET_OWNER_NOT_FOUND"
  | "MISSING_REQUIRED_PROPERTY"
  | "DUPLICATE_COMPANY_RECORD_ID"
  | "DUPLICATE_GROUP_RECORD_ID";

export type ConflictSeverity = "BLOCKING" | "WARNING";

export type Conflict = {
  type: ConflictType;
  severity: ConflictSeverity;
  recordId: string;
  message: string;
  recommendedAction: string;
};

export type AssignmentTarget = {
  ownerId: number;
  name: string;
  role: string;
  team: string;
};

export type AssignmentPreview = {
  status: "SIMULATED"; // never "APPLIED" in this phase
  assignmentType: AssignmentType;
  target: AssignmentTarget;
  selectedGroupCount: number;
  selectedCompanyCount: number;
  affectedCompanyIds: string[]; // deduplicated by Company Record ID
  affectedCompanyCount: number;
  eligibleCompanyIds: string[];
  eligibleCount: number;
  excludedCompanyIds: string[];
  excludedCount: number;
  currentOwnership: { ownerId: number | null; ownerName: string; count: number }[];
  conflicts: Conflict[];
};

// ---------------------------------------------------------------------------
// Assignment history (structure only — SIMULATED is the only mode this phase allows)
// ---------------------------------------------------------------------------

export type AssignmentHistoryEntry = {
  assignmentId: string;
  timestamp: string;
  performedBy: string; // email of whoever ran the simulation
  assignmentType: AssignmentType;
  selectedGroupIds: string[];
  selectedCompanyIds: string[];
  affectedCompanyIds: string[];
  previousOwners: { companyId: string; ownerId: number | null; ownerName: string }[];
  newOwner: AssignmentTarget;
  numberAffected: number;
  numberExcluded: number;
  conflicts: Conflict[];
  status: "SIMULATED";
  mode: "SIMULATED" | "PRODUCTION"; // PRODUCTION is reserved for a future phase — never set here
};

// ---------------------------------------------------------------------------
// Saved views / presets
// ---------------------------------------------------------------------------

export type SavedView = {
  id: string;
  name: string;
  assignmentType: AssignmentType;
  filters: FilterGroup;
  search: string;
  sort: { field: string; direction: "asc" | "desc" } | null;
  visibleColumns: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Structured errors (Phase 41) — never a silent "0 matching records" on a real failure
// ---------------------------------------------------------------------------

export type AssignmentErrorType =
  | "HUBSPOT_API_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "MISSING_ASSOCIATION"
  | "MISSING_PROPERTY"
  | "MALFORMED_RECORD"
  | "INVALID_RECORD_ID";

export type AssignmentError = {
  type: AssignmentErrorType;
  message: string;
  retryable: boolean;
};
