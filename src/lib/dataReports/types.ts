/**
 * Data Reports — canonical types. Fully isolated from src/lib/assignment/*
 * on purpose (per spec: "keep the implementation isolated to this tab") —
 * no shared module between the two features, even though some concepts
 * (filters, columns) look similar. Nothing here calls a HubSpot write
 * endpoint; this whole feature is read/export-oriented.
 */

export type PropertyOrigin = "standard" | "custom";
export type ColumnKind = "property" | "association";

/** One entry in the property/column registry (Phase 7/8). */
export type ReportColumnDef = {
  /** Exact display label from the spec — never silently renamed. */
  label: string;
  kind: ColumnKind;
  /** The real HubSpot internal property name — only set for kind "property". Never guessed. */
  internalName: string | null;
  /** Set for kind "association" — which associated object type this comes from. */
  associationObjectType?: "DEAL" | "CONTACT" | "DEALERSHIP_GROUP";
  type: "string" | "number" | "datetime" | "enumeration" | "bool";
  fieldType: string; // HubSpot's own fieldType string (text, number, select, calculation_rollup, ...) for property columns
  category: ReportPropertyCategory;
  /** True only when a real, confirmed match exists but its semantics look uncertain — surfaced in the UI, never hidden. */
  caveat?: string;
};

export type ReportPropertyCategory =
  | "Company"
  | "Ownership"
  | "Dealership"
  | "Dealership Group"
  | "Inventory"
  | "CRM"
  | "Activity"
  | "Geography"
  | "Website"
  | "Data Quality"
  | "Associations"
  | "Other";

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "doesNotContain"
  | "isKnown"
  | "isUnknown"
  | "equals"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual";

export type ReportFilter = {
  id: string;
  columnKey: string; // ReportColumnDef.label, used as the stable key throughout the UI
  operator: FilterOperator;
  value: string;
};

export type OwnerSelection = {
  ownerIds: number[]; // explicit owner IDs
  includeUnassigned: boolean;
};

/** The one canonical query definition — every count, the preview, and the CSV export all derive from exactly this (Phase 10/40 equivalent for this feature). */
export type ReportDefinition = {
  owners: OwnerSelection;
  columns: string[]; // ordered list of ReportColumnDef.label — CSV column order follows this exactly
  filters: ReportFilter[];
};

export type SavedReport = {
  id: string;
  name: string;
  description: string;
  definition: ReportDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RecentExport = {
  id: string;
  reportName: string;
  recordCount: number;
  columnCount: number;
  exportedAt: string;
  exportedBy: string;
};

export type ReportOwnerOption = {
  ownerId: number;
  name: string;
  team: string;
  isSystemOwner: boolean;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportSearchResult = {
  total: number;
  rows: ReportRow[];
  page: number;
  pageSize: number;
};
