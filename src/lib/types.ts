export type FilterOperator =
  | "EQ"
  | "NEQ"
  | "IN"
  | "NOT_IN"
  | "HAS_PROPERTY"
  | "NOT_HAS_PROPERTY"
  | "CONTAINS_TOKEN"
  | "GT";

export type PropertyFilter = {
  propertyName: string;
  operator: FilterOperator;
  value?: string;
  values?: string[];
};

export type FilterGroup = {
  filters: PropertyFilter[];
};

export type CompanyRecord = {
  id: string;
  name: string | null;
  domain: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  ownerId: number | null;
  ownerName: string | null;
  team: string | null;
  role: string | null;
  typeOfDealership: string | null;
  gdId: string | null;
  gdName: string | null;
  inGroupDealership: boolean;
};

export type OwnerCountsResult = {
  counts: Record<number, number>;
  unowned: number;
  total: number;
  computedAt: string;
};

export type OverviewResponse = {
  totalUsAccounts: number;
  franchise: number;
  independent: number;
  inGroupDealership: number;
  notInGroupDealership: number;
  groupFlagUnassigned: number;
  uniqueGroupDealerships: number | null;
  unownedUsAccounts: number;
  countryUnassignedTotal: number;
};

export type TeamTotal = {
  team: string;
  accountCount: number;
  memberCount: number;
  roleBreakdown: Record<string, number>;
};

export type TeamsResponse = {
  teams: TeamTotal[];
  systemBuckets: { ownerId: number; name: string; count: number }[];
  unmapped: { count: number; ownerCount: number };
  unowned: number;
};

export type MemberTotal = {
  ownerIds: number[];
  name: string;
  role: string;
  team: string;
  accountCount: number;
  isMerged: boolean;
  note?: string;
};

export type AccountsQuery = {
  page: number;
  team?: string;
  role?: string;
  ownerId?: number;
  city?: string;
  state?: string;
  country?: string;
  q?: string;
};

export type AccountsResponse = {
  rows: CompanyRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pageCap: number;
  cappedByHubSpot: boolean;
};

export type UnmappedOwner = {
  ownerId: number;
  name: string;
  archived: boolean;
  count: number;
};

export type UnmappedResponse = {
  systemBuckets: { ownerId: number; name: string; count: number }[];
  unmappedOwners: UnmappedOwner[];
  unowned: { count: number };
  page: number;
  pageSize: number;
  total: number;
};

export type ValidationReport = {
  totalDistinctUsAccounts: number;
  ownersWithUsAccounts: number;
  teamTotals: { team: string; accountCount: number }[];
  memberTotals: { name: string; accountCount: number }[];
  unmappedOwnerCount: number;
  unmappedAccountCount: number;
  systemBucketAccountCount: number;
  unownedCount: number;
  reconciliation: { pass: boolean; delta: number };
  dealershipTypeReconciliation: { pass: boolean; franchise: number; independent: number; total: number };
  countryUnassignedTotal: number;
  duplicateRecordIds: { count: 0; reason: string };
  paginationComplete: { explanation: string };
  totalsServerSide: { explanation: string };
  computedAt: string;
};
