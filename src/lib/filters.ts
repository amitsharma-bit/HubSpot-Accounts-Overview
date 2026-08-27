import type { FilterGroup, PropertyFilter, FilterScope } from "./types";

/**
 * ROOT-CAUSE DECISION (see conversation, 2026-08-27): this app originally used
 * the free-text `country` property (values 'United States'/'USA'/'US'), which
 * gave ~67k accounts and was geographically self-consistent per record. The
 * user's external "current correct" baseline (119,751) instead comes from
 * `country_dropdown`, confirmed by direct live query. `country_dropdown` is
 * known to be self-contradictory on individual records (e.g. records tagged
 * `country_dropdown='United States'` whose real `country` free-text says
 * "Canada"/"India") — flagged explicitly before this was chosen. The user
 * chose `country_dropdown` anyway as the standard going forward; this file
 * implements that choice. If accuracy complaints resurface, this is the first
 * place to revisit.
 */
export const COUNTRY_PROPERTY = "country_dropdown";
export const DEFAULT_COUNTRY = "United States";

/**
 * The best-populated of three competing state-like properties in this portal
 * (`state_drop_down`, `overall_state_dropdown`, free-text `state`) — verified
 * live: under country_dropdown='United States' scope, state_drop_down is
 * populated on 103,896/119,751 records vs. 62,320 and 66,522 for the other
 * two. It also includes a stray "Ontario" option (a legacy data artifact) —
 * left as-is rather than special-cased, since the option-discovery endpoint
 * only surfaces values with >0 matching records for the active scope, so it
 * simply won't appear unless real records actually use it.
 */
export const STATE_PROPERTY = "state_drop_down";

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

/**
 * Dealership classification (see conversation, 2026-08-27): `type_of_dealership`
 * is natively just Independent/Franchise (verified: exactly 2 options, no
 * third native value). "In Group Dealership" as a third, mutually-exclusive
 * category is a business rule composed from two real properties — group
 * membership takes priority over type. Verified live: under
 * country_dropdown='United States' scope this composition reproduces the
 * user's 119,751 baseline exactly (Independent-not-in-group + Franchise-not-
 * in-group + In-Group = total, no gaps, no overlap).
 */
export type DealershipClass = "Independent" | "Franchise" | "Group";

export function classifyDealership(
  typeOfDealership: string | null | undefined,
  groupFlagRaw: string | null | undefined
): DealershipClass | null {
  if (normalizeGroupFlag(groupFlagRaw)) return "Group";
  if (typeOfDealership === "Franchise") return "Franchise";
  if (typeOfDealership === "Independent") return "Independent";
  return null;
}

export function countryFilter(country: string = DEFAULT_COUNTRY): PropertyFilter {
  return { propertyName: COUNTRY_PROPERTY, operator: "EQ", value: country };
}

export const GROUP_DEALERSHIP_FILTER: PropertyFilter = {
  propertyName: "is_this_is_a_part_of_group_dealership_",
  operator: "IN",
  values: [...GROUP_FLAG_TRUE],
};

export const NOT_GROUP_DEALERSHIP_FILTER: PropertyFilter = {
  propertyName: "is_this_is_a_part_of_group_dealership_",
  operator: "NOT_IN",
  values: [...GROUP_FLAG_TRUE],
};

export function dealershipClassFilters(cls: DealershipClass): PropertyFilter[] {
  if (cls === "Group") return [GROUP_DEALERSHIP_FILTER];
  return [{ propertyName: "type_of_dealership", operator: "EQ", value: cls }, NOT_GROUP_DEALERSHIP_FILTER];
}

/** Shared across every API route so the sidebar filters mean the same thing everywhere. */
export function parseFilterScope(params: URLSearchParams): FilterScope {
  const dealershipClass = params.get("dealershipClass");
  return {
    country: params.get("country") ?? undefined,
    state: params.get("state") ?? undefined,
    city: params.get("city") ?? undefined,
    dealershipClass:
      dealershipClass === "Independent" || dealershipClass === "Franchise" || dealershipClass === "Group"
        ? dealershipClass
        : undefined,
  };
}

/** Stable cache key for a filter scope — key order must not matter. */
export function scopeCacheKey(scope: FilterScope): string {
  return JSON.stringify([scope.country ?? DEFAULT_COUNTRY, scope.state ?? "", scope.city ?? "", scope.dealershipClass ?? ""]);
}

export function isDefaultScope(scope: FilterScope): boolean {
  return !scope.state && !scope.city && !scope.dealershipClass && (!scope.country || scope.country === DEFAULT_COUNTRY);
}

export type AccountFilterInput = {
  country?: string;
  state?: string;
  city?: string;
  dealershipClass?: DealershipClass;
  ownerIds?: number[];
  unownedOnly?: boolean;
  searchTerm?: string;
  searchMatchedOwnerIds?: number[];
};

/**
 * HubSpot semantics: filterGroups are OR'd together, filters within one group
 * are AND'd. Hard caps: 5 groups, 6 filters per group. Every AND condition that
 * must apply regardless of which OR branch matched (country + owner scope +
 * state/city/class) has to be duplicated into EVERY group — this is the exact
 * mistake that produces wrong totals, so it's covered by scripts/check.ts.
 */
export function buildFilterGroups(input: AccountFilterInput): FilterGroup[] {
  const baseFilters: PropertyFilter[] = [countryFilter(input.country)];

  if (input.unownedOnly) {
    baseFilters.push({ propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" });
  } else if (input.ownerIds && input.ownerIds.length > 0) {
    baseFilters.push({ propertyName: "hubspot_owner_id", operator: "IN", values: input.ownerIds.map(String) });
  }

  if (input.state) baseFilters.push({ propertyName: STATE_PROPERTY, operator: "EQ", value: input.state });
  if (input.city) baseFilters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: input.city });
  if (input.dealershipClass) baseFilters.push(...dealershipClassFilters(input.dealershipClass));

  // Free-text search: OR across name/domain/matched-owner, each branch still
  // carrying every base (AND) filter. State/city/class are dedicated facet
  // filters above, not search targets.
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
