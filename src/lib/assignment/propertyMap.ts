/**
 * Centralized HubSpot property mapping (Phase 5). Every real property name
 * used by the Data Assignment engine is declared here — nowhere else in this
 * module hardcodes a raw HubSpot property string. Every mapping below was
 * confirmed live against this portal (see the conversation this was built
 * in); nothing here is guessed.
 */

/** The real custom object powering "Dealership Group" — confirmed live, 3,417 records. */
export const GROUP_OBJECT_TYPE = "p242626590_dealship_group_names";

/**
 * The real HubSpot association between Group and Company (type 17/18,
 * internal name "company_to_dealship_group_names"). Confirmed live: for a
 * sample group, this association's target IDs exactly matched the group's
 * `rooftops` rollup count, and each target company's `gd_id` property
 * equalled the group's own record ID. Two OTHER association type pairs
 * ("dealership_group" 19/20, "group_name" 21/22) also exist in the schema
 * between these two object types but were not found populated on the
 * records checked — treated as legacy/unused unless proven otherwise.
 */
export const GROUP_TO_COMPANY_ASSOCIATION = "companies";

export const GROUP_PROPERTIES = {
  groupName: "dealship_group_name",
  ownerId: "hubspot_owner_id",
  ownerAssignedDate: "hubspot_owner_assigneddate",
  dealershipRank: "dealership_rank",
  gdStage: "gd_stage",
  gdTier: "gd_tier",
  actualRooftops: "rooftops", // rollup: count of really-associated companies
  usedCars: "used_cars__gd_",
  newCars: "new_cars__gd_",
  totalCars: "number_of_cars__gd_level_",
  gdLastActivity: "gd_last_activity",
  currentStatus: "current_status",
  createdDate: "hs_createdate",
  lastModifiedDate: "hs_lastmodifieddate",
} as const;

export const GROUP_PROPERTY_LIST = Object.values(GROUP_PROPERTIES);

/** Real Company properties this module reads. Reuses the SAME names already
 * verified live by the existing Overview/Control Center codebase where they
 * overlap (see src/app/api/company/[id]/route.ts) plus newly-confirmed ones. */
export const COMPANY_PROPERTIES = {
  companyName: "name",
  domain: "domain",
  gdName: "gd_name",
  gdRecordId: "gd_id",
  potentialRooftops: "potential_rooftops",
  lifecycleStage: "lifecyclestage",
  gdLevel: "lifecycle_stage_gd_level",
  ownerId: "hubspot_owner_id",
  ownerTeamId: "hubspot_team_id",
  ownerAssignedDate: "hubspot_owner_assigneddate",
  lastActivityDate: "rooftop_last_activity", // deliberately distinct from GD-level activity (Phase 14)
  associatedContacts: "num_associated_contacts",
  usedCars: "number_of_used_cars",
  newCars: "number_of_new_cars",
  totalCars: "total_cars",
  gdCars: "number_of_cars__gd_level_",
  isPartOfGroupDealership: "is_this_is_a_part_of_group_dealership_",
  associatedDeals: "num_associated_deals",
  websiteStatus: "website_status",
  dealershipType: "type_of_dealership",
  marketSegment: "market_segment", // synced by an EXTERNAL "TAM dashboard" job — read-only, never computed here
  city: "city",
  state: "state_drop_down",
  country: "country_dropdown",
  createdDate: "createdate",
  lastModifiedDate: "hs_lastmodifieddate",
} as const;

export const COMPANY_PROPERTY_LIST = Object.values(COMPANY_PROPERTIES);

/**
 * Fields the spec asked for that do NOT exist as real properties on the
 * Group object, confirmed live (portal 242626590). Surfaced explicitly per
 * Phase 5 ("if a required property cannot be identified, STOP and report
 * it") rather than silently omitted. Every consumer of `DealershipGroup`
 * must treat these as always-null, not attempt to compute a substitute.
 */
export const GROUP_KNOWN_GAPS: Record<string, string> = {
  potentialRooftops: "No property found on p242626590_dealship_group_names for a target/potential rooftop count distinct from the real `rooftops` actual-count rollup.",
  contactsCount: "No contacts-count property found on the Group object (Company has num_associated_contacts; the Group object has no equivalent).",
  marketSegment: "No market_segment-equivalent property found on the Group object (Company has one, synced by an external TAM dashboard job).",
  country: "No native geography property on the Group object — see Phase 7's aggregation rule; derived from associated companies, not stored on the Group.",
  state: "Same as country — not a native Group property.",
  city: "Same as country — not a native Group property.",
  county: "Does not exist anywhere in this portal (confirmed across all Company properties in an earlier session); the Group object has no county property either.",
};
