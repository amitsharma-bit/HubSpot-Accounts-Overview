import type { FilterFieldType, FilterOperator } from "./types";

/** Drives the (deliberately plain/utilitarian, per spec) filter-builder UI. */
export type FieldDef = { field: string; label: string; type: FilterFieldType };

export const GROUP_FIELDS: FieldDef[] = [
  { field: "groupName", label: "Group Name", type: "TEXT" },
  { field: "gdStage", label: "GD Stage", type: "TEXT" },
  { field: "gdTier", label: "GD Tier", type: "TEXT" },
  { field: "dealershipRank", label: "Dealership Rank", type: "TEXT" },
  { field: "actualRooftops", label: "Actual Rooftops", type: "NUMBER" },
  { field: "usedCars", label: "Used Cars (GD)", type: "NUMBER" },
  { field: "newCars", label: "New Cars (GD)", type: "NUMBER" },
  { field: "totalCars", label: "Total Cars (GD)", type: "NUMBER" },
  { field: "gdLastActivity", label: "GD Last Activity", type: "DATE" },
  { field: "ownerTeam", label: "Owner Team", type: "TEXT" },
  { field: "currentStatus", label: "Current Status", type: "TEXT" },
];

/** Same fields, evaluated per-rooftop for an AGGREGATED_ROOFTOPS-scope filter. */
export const ROOFTOP_AGGREGATION_FIELDS: FieldDef[] = [
  { field: "country", label: "Country", type: "ENUM" },
  { field: "usedCars", label: "Used Cars", type: "NUMBER" },
  { field: "newCars", label: "New Cars", type: "NUMBER" },
  { field: "totalCars", label: "Total Cars", type: "NUMBER" },
  { field: "lastActivityDate", label: "Rooftop Last Activity", type: "DATE" },
];

export const COMPANY_FIELDS: FieldDef[] = [
  { field: "companyName", label: "Company Name", type: "TEXT" },
  { field: "domain", label: "Domain", type: "TEXT" },
  { field: "gdName", label: "GD Name", type: "TEXT" },
  { field: "city", label: "City", type: "TEXT" },
  { field: "state", label: "State", type: "TEXT" },
  { field: "country", label: "Country", type: "ENUM" },
  { field: "potentialRooftops", label: "Potential Rooftops", type: "NUMBER" },
  { field: "usedCars", label: "Used Cars", type: "NUMBER" },
  { field: "newCars", label: "New Cars", type: "NUMBER" },
  { field: "totalCars", label: "Total Cars", type: "NUMBER" },
  { field: "gdCars", label: "Cars (GD Level)", type: "NUMBER" },
  { field: "associatedContacts", label: "Associated Contacts", type: "NUMBER" },
  { field: "associatedDeals", label: "Associated Deals", type: "NUMBER" },
  { field: "lifecycleStage", label: "Lifecycle Stage", type: "TEXT" },
  { field: "gdLevel", label: "GD Level", type: "TEXT" },
  { field: "websiteStatus", label: "Website Status", type: "TEXT" },
  { field: "marketSegment", label: "Market Segment", type: "TEXT" },
  { field: "dealershipType", label: "Type of Dealership", type: "TEXT" },
  { field: "lastActivityDate", label: "Last Activity Date", type: "DATE" },
  { field: "createdDate", label: "Created Date", type: "DATE" },
  { field: "lastModifiedDate", label: "Last Modified Date", type: "DATE" },
];

export const OPERATORS_BY_TYPE: Record<FilterFieldType, { value: FilterOperator; label: string }[]> = {
  TEXT: [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "notContains", label: "does not contain" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
    { value: "isKnown", label: "is known" },
    { value: "isUnknown", label: "is unknown" },
  ],
  NUMBER: [
    { value: "equals", label: "=" },
    { value: "notEquals", label: "!=" },
    { value: "greaterThan", label: ">" },
    { value: "greaterThanOrEqual", label: ">=" },
    { value: "lessThan", label: "<" },
    { value: "lessThanOrEqual", label: "<=" },
    { value: "between", label: "between" },
    { value: "notBetween", label: "not between" },
    { value: "isKnown", label: "is known" },
    { value: "isUnknown", label: "is unknown" },
  ],
  DATE: [
    { value: "equals", label: "on" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "between", label: "between" },
    { value: "withinLast", label: "within last N days" },
    { value: "withinNext", label: "within next N days" },
    { value: "olderThan", label: "older than N days" },
    { value: "newerThan", label: "newer than N days" },
    { value: "isKnown", label: "is known" },
    { value: "isUnknown", label: "is unknown" },
  ],
  ENUM: [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
    { value: "isAnyOf", label: "is any of" },
    { value: "isNoneOf", label: "is none of" },
    { value: "isKnown", label: "is known" },
    { value: "isUnknown", label: "is unknown" },
  ],
  BOOLEAN: [
    { value: "isTrue", label: "is true" },
    { value: "isFalse", label: "is false" },
    { value: "isKnown", label: "is known" },
    { value: "isUnknown", label: "is unknown" },
  ],
};
