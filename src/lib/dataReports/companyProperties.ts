import type { ReportColumnDef } from "./types";

/**
 * The Data Reports property/column registry (Phase 7/8/14). Every
 * `internalName` below was confirmed live against this portal's real
 * `/crm/v3/properties/companies` response — nothing here is guessed. Exact
 * display labels match the spec verbatim; never silently renamed.
 *
 * Five columns are `kind: "association"`, not simple Company properties —
 * confirmed by searching the full property list for a plausible match and
 * finding none (Phase 15): "Associated Deal", "Associated Deal IDs",
 * "Associated Contact", "Associated Contact IDs", and "Associated
 * Dealership Group Name IDs" (the last one uses the real
 * p242626590_dealship_group_names association discovered while building
 * Data Assignment — see src/lib/dataReports/associations.ts).
 */
export const COMPANY_REPORT_COLUMNS: ReportColumnDef[] = [
  { label: "Record ID", kind: "property", internalName: "hs_object_id", type: "string", fieldType: "text", category: "Company" },
  { label: "Company name", kind: "property", internalName: "name", type: "string", fieldType: "text", category: "Company" },
  { label: "Company Domain Name", kind: "property", internalName: "domain", type: "string", fieldType: "text", category: "Company" },
  { label: "GD Name", kind: "property", internalName: "gd_name", type: "string", fieldType: "text", category: "Dealership Group" },
  { label: "#Potential Rooftops", kind: "property", internalName: "potential_rooftops", type: "number", fieldType: "number", category: "Dealership" },
  { label: "Owner assigned date", kind: "property", internalName: "hubspot_owner_assigneddate", type: "datetime", fieldType: "date", category: "Ownership" },
  { label: "Last Activity Date", kind: "property", internalName: "notes_last_updated", type: "datetime", fieldType: "date", category: "Activity" },
  { label: "Rooftop Last Activity", kind: "property", internalName: "rooftop_last_activity", type: "datetime", fieldType: "calculation_rollup", category: "Activity" },
  { label: "Lifecycle Stage (GD Level)", kind: "property", internalName: "lifecycle_stage_gd_level", type: "enumeration", fieldType: "select", category: "Dealership Group" },
  { label: "Company owner", kind: "property", internalName: "hubspot_owner_id", type: "enumeration", fieldType: "select", category: "Ownership" },
  { label: "Number of Associated Contacts", kind: "property", internalName: "num_associated_contacts", type: "number", fieldType: "calculation_rollup", category: "CRM" },
  { label: "Number Of Used Cars", kind: "property", internalName: "number_of_used_cars", type: "number", fieldType: "number", category: "Inventory" },
  { label: "Number of New Cars", kind: "property", internalName: "number_of_new_cars", type: "number", fieldType: "number", category: "Inventory" },
  { label: "Total cars", kind: "property", internalName: "total_cars", type: "number", fieldType: "number", category: "Inventory" },
  { label: "Number of cars (GD Level)", kind: "property", internalName: "number_of_cars__gd_level_", type: "number", fieldType: "number", category: "Inventory" },
  { label: "Is this is a part of Group Dealership?", kind: "property", internalName: "is_this_is_a_part_of_group_dealership_", type: "enumeration", fieldType: "select", category: "Dealership Group" },
  { label: "Associated Deal", kind: "association", internalName: null, associationObjectType: "DEAL", type: "string", fieldType: "association", category: "Associations" },
  { label: "Website Status", kind: "property", internalName: "website_status", type: "enumeration", fieldType: "select", category: "Website" },
  { label: "OEM's", kind: "property", internalName: "oem_s", type: "enumeration", fieldType: "select", category: "Dealership" },
  { label: "Number of Associated Deals", kind: "property", internalName: "num_associated_deals", type: "number", fieldType: "calculation_rollup", category: "CRM" },
  { label: "Market Segment", kind: "property", internalName: "market_segment", type: "string", fieldType: "text", category: "Data Quality" },
  { label: "City", kind: "property", internalName: "city", type: "string", fieldType: "text", category: "Geography" },
  { label: "State Drop Down", kind: "property", internalName: "state_drop_down", type: "enumeration", fieldType: "select", category: "Geography" },
  { label: "Country Dropdown", kind: "property", internalName: "country_dropdown", type: "enumeration", fieldType: "select", category: "Geography" },
  {
    label: "HubSpot Team",
    kind: "property",
    internalName: "hubspot_team_id",
    type: "enumeration",
    fieldType: "select",
    category: "Ownership",
    caveat:
      "This app can't resolve hubspot_team_id to a friendly team name (the private-app token lacks settings.users.teams.read — confirmed via a live 403 elsewhere in this codebase). The export instead shows the pod/team already assigned to the Company Owner in this app's own roster, per Phase 16's \"derive from the selected Company Owner's team\" instruction — not HubSpot's native Team object.",
  },
  { label: "Data Type", kind: "property", internalName: "data_type", type: "enumeration", fieldType: "select", category: "Data Quality" },
  { label: "DMS Name", kind: "property", internalName: "dms_name", type: "enumeration", fieldType: "select", category: "Dealership" },
  { label: "Event name", kind: "property", internalName: "event_name", type: "enumeration", fieldType: "checkbox", category: "CRM" },
  { label: "Associated Contact", kind: "association", internalName: null, associationObjectType: "CONTACT", type: "string", fieldType: "association", category: "Associations" },
  { label: "Partner Name", kind: "property", internalName: "partner_name", type: "enumeration", fieldType: "select", category: "Other" },
  { label: "Type of Dealership", kind: "property", internalName: "type_of_dealership", type: "enumeration", fieldType: "select", category: "Dealership" },
  { label: "Type of business", kind: "property", internalName: "type_of_business", type: "enumeration", fieldType: "select", category: "Other" },
  { label: "Create Date", kind: "property", internalName: "createdate", type: "datetime", fieldType: "date", category: "Activity" },
  { label: "Associated Dealership Group Name IDs", kind: "association", internalName: null, associationObjectType: "DEALERSHIP_GROUP", type: "string", fieldType: "association", category: "Associations" },
  { label: "Associated Deal IDs", kind: "association", internalName: null, associationObjectType: "DEAL", type: "string", fieldType: "association", category: "Associations" },
  { label: "Associated Contact IDs", kind: "association", internalName: null, associationObjectType: "CONTACT", type: "string", fieldType: "association", category: "Associations" },
];

/**
 * A real property named `associated_contacts` ("Associated Contacts", an
 * enumeration select) does exist in this portal but was deliberately NOT
 * used for the "Associated Contact" column above — its field type (a select
 * dropdown, not a rollup or association) doesn't match what that column is
 * supposed to represent, and presenting it as if it were the real
 * association data would risk being wrong. Flagged here rather than guessed;
 * ask whoever owns the HubSpot schema what `associated_contacts` is actually
 * for before using it anywhere.
 */
export const KNOWN_AMBIGUOUS_PROPERTY_NOTE =
  "A property named 'associated_contacts' exists in HubSpot but is an enumeration/select field, not a real contact association or rollup — not used for the 'Associated Contact' column pending clarification.";

export const CATEGORY_ORDER: ReportColumnDef["category"][] = [
  "Company",
  "Ownership",
  "Dealership",
  "Dealership Group",
  "Inventory",
  "CRM",
  "Activity",
  "Geography",
  "Website",
  "Data Quality",
  "Associations",
  "Other",
];

export const DEFAULT_COLUMNS: string[] = ["Record ID", "Company name", "Company Domain Name", "Company owner", "City", "State Drop Down", "Country Dropdown"];

export function findColumnDef(label: string): ReportColumnDef | undefined {
  return COMPANY_REPORT_COLUMNS.find((c) => c.label === label);
}
