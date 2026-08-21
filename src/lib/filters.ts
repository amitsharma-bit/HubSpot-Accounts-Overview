import type { FilterGroup, PropertyFilter } from "./types";

/**
 * Verified live against the real portal (see docs/../plan): `country` is free
 * text, not an enum, and these are the only three values that mean "US".
 * Do NOT use `country_dropdown` (proven unreliable — contradicts `country` on
 * the same records) or `hs_country_code` (only ~3% of companies have it set).
 */
export const US_COUNTRY_VALUES = ["United States", "USA", "US"] as const;

/**
 * `is_this_is_a_part_of_group_dealership_` is an enumeration whose real stored
 * value is `"true"` (label "Yes") / `"false"` (label "No") — verified via
 * get_properties. HubSpot's reporting/analytics surface displays this kind of
 * boolean-shaped enum as "Yes (true)" / "No (false)" (label + raw value, for
 * disambiguation), which looks like the stored value but is NOT filterable —
 * `EQ 'Yes (true)'` returns zero rows. Filtering on that display string
 * instead of the real value silently returns near-zero results. There is also
 * a small legacy bucket (71 records) with the stale raw string `"Yes"` from
 * before the property was normalized to `"true"`/`"false"` — both must be
 * treated as true or the group-dealership count undercounts.
 */
export const GROUP_FLAG_TRUE = ["true", "Yes"] as const;
export const GROUP_FLAG_FALSE = "false";

export function normalizeGroupFlag(raw: string | null | undefined): boolean {
  return !!raw && (GROUP_FLAG_TRUE as readonly string[]).includes(raw);
}

export const COUNTRY_FILTER: PropertyFilter = {
  propertyName: "country",
  operator: "IN",
  values: [...US_COUNTRY_VALUES],
};

export const GROUP_DEALERSHIP_FILTER: PropertyFilter = {
  propertyName: "is_this_is_a_part_of_group_dealership_",
  operator: "IN",
  values: [...GROUP_FLAG_TRUE],
};

export type AccountFilterInput = {
  ownerIds?: number[];
  unownedOnly?: boolean;
  city?: string;
  state?: string;
  typeOfDealership?: string;
  searchTerm?: string;
  searchMatchedOwnerIds?: number[];
};

/**
 * HubSpot semantics: filterGroups are OR'd together, filters within one group
 * are AND'd. Hard caps: 5 groups, 6 filters per group. Every AND condition that
 * must apply regardless of which OR branch matched (country + owner scope +
 * city/state/type) has to be duplicated into EVERY group — this is the exact
 * mistake that produces wrong totals, so it's covered by scripts/check.ts.
 */
export function buildFilterGroups(input: AccountFilterInput): FilterGroup[] {
  const baseFilters: PropertyFilter[] = [COUNTRY_FILTER];

  if (input.unownedOnly) {
    baseFilters.push({ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" });
  } else if (input.ownerIds && input.ownerIds.length > 0) {
    baseFilters.push({ propertyName: "hubspot_owner_id", operator: "IN", values: input.ownerIds.map(String) });
  }

  if (input.city) baseFilters.push({ propertyName: "city", operator: "EQ", value: input.city });
  if (input.state) baseFilters.push({ propertyName: "state", operator: "EQ", value: input.state });
  if (input.typeOfDealership) {
    baseFilters.push({ propertyName: "type_of_dealership", operator: "EQ", value: input.typeOfDealership });
  }

  // Free-text search: OR across name/domain/matched-owner, each branch still
  // carrying every base (AND) filter. City/state are dedicated facet filters
  // above, not search targets — typing a city into the search box won't match
  // it; use the city facet instead.
  if (input.searchTerm) {
    const branches: PropertyFilter[][] = [
      [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: input.searchTerm }],
      [{ propertyName: "domain", operator: "CONTAINS_TOKEN", value: input.searchTerm }],
    ];
    if (input.searchMatchedOwnerIds && input.searchMatchedOwnerIds.length > 0) {
      branches.push([{ propertyName: "hubspot_owner_id", operator: "IN", values: input.searchMatchedOwnerIds.map(String) }]);
    }
    return branches
      .slice(0, 5)
      .map((branchFilters) => ({ filters: [...baseFilters, ...branchFilters].slice(0, 6) }));
  }

  return [{ filters: baseFilters.slice(0, 6) }];
}
