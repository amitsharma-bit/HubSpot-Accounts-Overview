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
  dealershipClass: "Independent" | "Franchise" | "Group" | null;
  gdId: string | null;
  gdName: string | null;
  inGroupDealership: boolean;
  potentialRooftops: number | null;
  lastActivityDate: string | null;
};

export type FilterScope = {
  country?: string;
  state?: string;
  city?: string;
  dealershipClass?: "Independent" | "Franchise" | "Group";
};

export type OwnerCountsResult = {
  counts: Record<number, number>;
  unowned: number;
  total: number;
  computedAt: string;
};

export type OverviewResponse = {
  totalUsAccounts: number;
  /** Independent, and NOT in a group dealership (mutually exclusive with franchise/group). */
  independent: number;
  /** Franchise, and NOT in a group dealership (mutually exclusive with independent/group). */
  franchise: number;
  /** In a group dealership, regardless of Independent/Franchise type (takes priority — see classifyDealership). */
  inGroupDealership: number;
  salesOps: { accounts: number; owners: { ownerId: number; name: string }[] };
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

export type AccountsResponse = {
  rows: CompanyRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pageCap: number;
  cappedByHubSpot: boolean;
};

export type CompanyDetail = {
  id: string;
  name: string | null;
  domain: string | null;
  ownerName: string | null;
  team: string | null;
  role: string | null;
  lifecycleStage: string | null;
  hubspotTeamId: string | null;
  gdLevel: string | null;
  numberOfUsedCars: number | null;
  potentialRooftops: number | null;
  gdName: string | null;
  gdId: string | null;
  inGroupDealership: boolean;
  numAssociatedContacts: number | null;
  lastActivityDate: string | null;
  ownerAssignedDate: string | null;
  hubspotUrl: string | null;
};

export type GroupCompanyRow = {
  id: string;
  name: string | null;
  domain: string | null;
  ownerName: string | null;
  ownerAssignedDate: string | null;
  lastActivityDate: string | null;
  potentialRooftops: number | null;
};

export type GroupDetail = {
  gdId: string;
  gdName: string | null;
  gdStage: string | null;
  gdLastActivityDate: string | null;
  totalContacts: number;
  totalCompanies: number;
  totalPotentialRooftops: number;
  companies: GroupCompanyRow[];
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
  /** independent + franchise + inGroupDealership === total, with no double counting. */
  classificationReconciliation: { pass: boolean; independent: number; franchise: number; inGroupDealership: number; total: number };
  duplicateRecordIds: { count: 0; reason: string };
  paginationComplete: { explanation: string };
  totalsServerSide: { explanation: string };
  computedAt: string;
};
