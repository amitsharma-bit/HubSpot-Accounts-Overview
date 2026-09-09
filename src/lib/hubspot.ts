import type { FilterGroup } from "./types";

const BASE = "https://api.hubapi.com";

function token(): string {
  const t = process.env.HUBSPOT_TOKEN;
  if (!t) throw new Error("HUBSPOT_TOKEN is not set. Copy .env.example to .env.local and fill it in.");
  return t;
}

// ponytail: single module-level gate serializing requests ~4/sec. Only matters
// if this app ever serves more than one local user — then it's a real queue.
let nextSlot = 0;
async function rateGate(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 250;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function hubspotFetch(path: string, init: RequestInit, attempt = 1): Promise<Response> {
  await rateGate();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if ((res.status === 429 || res.status >= 500) && attempt <= 3) {
    const retryAfter = Number(res.headers.get("Retry-After")) || attempt * 2;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return hubspotFetch(path, init, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HubspotHttpError(res.status, `HubSpot ${path} failed: ${res.status} ${body}`);
  }
  return res;
}

export class HubspotHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export class PageBeyondLimitError extends Error {
  constructor() {
    super("Refine filters — HubSpot caps paged search at 10,000 records.");
  }
}

type SearchBody = {
  filterGroups: FilterGroup[];
  properties?: string[];
  limit?: number;
  after?: string;
  sorts?: { propertyName: string; direction: "ASCENDING" | "DESCENDING" }[];
};

type SearchResult = { total: number; results: { id: string; properties: Record<string, string | null> }[] };

async function search(body: SearchBody): Promise<SearchResult> {
  const res = await hubspotFetch("/crm/v3/objects/companies/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Every aggregate number in this app comes from here: limit:1, read only `total`. */
export async function countCompanies(filterGroups: FilterGroup[]): Promise<number> {
  const { total } = await search({ filterGroups, limit: 1, properties: ["hs_object_id"] });
  return total;
}

const ACCOUNTS_PAGE_SIZE = 25;
const SCAN_BATCH_SIZE = 100;
const HUBSPOT_SEARCH_ROW_CAP = 10_000;

export type SortSpec = { propertyName: string; direction: "ASCENDING" | "DESCENDING" };

export async function searchCompanies(
  filterGroups: FilterGroup[],
  page: number,
  properties: string[],
  opts?: { pageSize?: number; sort?: SortSpec }
): Promise<{ total: number; results: { id: string; properties: Record<string, string | null> }[] }> {
  const pageSize = opts?.pageSize ?? ACCOUNTS_PAGE_SIZE;
  if ((page - 1) * pageSize >= HUBSPOT_SEARCH_ROW_CAP) throw new PageBeyondLimitError();
  // HubSpot's search API rejects more than one sort field ("too many sorts,
  // max allowed: 1"), so a stable hs_object_id tie-breaker can't be appended
  // alongside an explicit column sort — only used as the sole sort when no
  // column sort is requested.
  const sorts: SortSpec[] = opts?.sort ? [opts.sort] : [{ propertyName: "hs_object_id", direction: "ASCENDING" }];
  return search({
    filterGroups,
    properties,
    limit: pageSize,
    after: String((page - 1) * pageSize),
    sorts,
  });
}

export async function getCompanyById(id: string, properties: string[]): Promise<{ id: string; properties: Record<string, string | null> } | null> {
  const qs = new URLSearchParams({ properties: properties.join(",") });
  try {
    const res = await hubspotFetch(`/crm/v3/objects/companies/${encodeURIComponent(id)}?${qs.toString()}`, { method: "GET" });
    return res.json();
  } catch (err) {
    if (err instanceof HubspotHttpError && err.status === 404) return null;
    throw err;
  }
}

export type AccountInfo = { portalId: number; uiDomain: string };

export async function getAccountInfo(): Promise<AccountInfo> {
  const res = await hubspotFetch("/account-info/v3/details", { method: "GET" });
  const json = await res.json();
  return { portalId: json.portalId, uiDomain: json.uiDomain };
}

/**
 * Walks every matching company past the 10k search ceiling by re-anchoring on
 * hs_object_id once a window is exhausted. Only used where we genuinely need
 * every record (group-dealership rollup, future CSV export) — never for
 * anything that only needs a count.
 */
export async function* scanCompanies(
  filterGroups: FilterGroup[],
  properties: string[]
): AsyncGenerator<{ id: string; properties: Record<string, string | null> }[]> {
  let lastId = "0";
  while (true) {
    const anchored: FilterGroup[] = filterGroups.map((g) => ({
      filters: [...g.filters, { propertyName: "hs_object_id", operator: "GT" as const, value: lastId }].slice(0, 6),
    }));
    let after = 0;
    let sawAny = false;
    while (true) {
      const page = await search({
        filterGroups: anchored,
        properties,
        limit: SCAN_BATCH_SIZE,
        after: String(after),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      });
      if (page.results.length === 0) break;
      sawAny = true;
      yield page.results;
      lastId = page.results[page.results.length - 1].id;
      after += SCAN_BATCH_SIZE;
      if (after >= HUBSPOT_SEARCH_ROW_CAP) break;
    }
    if (!sawAny) break;
  }
}

export type HubspotProperty = {
  name: string;
  label: string;
  type: string;
  options: { value: string; label: string }[];
};

export async function getCompanyProperties(): Promise<HubspotProperty[]> {
  const res = await hubspotFetch("/crm/v3/properties/companies?archived=false", { method: "GET" });
  const json = await res.json();
  return (json.results ?? []).map((p: { name: string; label: string; type: string; options?: { value: string; label: string }[] }) => ({
    name: p.name,
    label: p.label,
    type: p.type,
    options: p.options ?? [],
  }));
}

/**
 * Generic, object-type-parameterized variants of the Company-only helpers
 * above — added for the Data Assignment module (src/lib/assignment/*), which
 * needs to read the real p242626590_dealship_group_names custom object.
 * Deliberately additive: nothing above this line changed, so Overview/
 * Control Center's behavior is untouched. Reuses the same rate gate, retry,
 * and error handling as every other call in this file — no second client.
 */

export async function searchObjects(objectType: string, body: SearchBody): Promise<SearchResult> {
  const res = await hubspotFetch(`/crm/v3/objects/${encodeURIComponent(objectType)}/search`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getObjectById(
  objectType: string,
  id: string,
  properties: string[]
): Promise<{ id: string; properties: Record<string, string | null> } | null> {
  const qs = new URLSearchParams({ properties: properties.join(",") });
  try {
    const res = await hubspotFetch(`/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(id)}?${qs.toString()}`, {
      method: "GET",
    });
    return res.json();
  } catch (err) {
    if (err instanceof HubspotHttpError && err.status === 404) return null;
    throw err;
  }
}

export async function batchReadObjects(
  objectType: string,
  ids: string[],
  properties: string[]
): Promise<{ id: string; properties: Record<string, string | null> }[]> {
  if (ids.length === 0) return [];
  const results: { id: string; properties: Record<string, string | null> }[] = [];
  // HubSpot's batch/read caps at 100 inputs per call.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await hubspotFetch(`/crm/v3/objects/${encodeURIComponent(objectType)}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties, inputs: chunk.map((id) => ({ id })) }),
    });
    const json = await res.json();
    results.push(...(json.results ?? []));
  }
  return results;
}

/**
 * Batch-reads the association between many "from" objects and one "to"
 * object type in as few calls as possible (Phase 42 — no one-request-per-row
 * fan-out). HubSpot's v4 batch associations endpoint caps at 100 "from" IDs
 * per call.
 */
export async function batchGetAssociations(
  fromObjectType: string,
  fromIds: string[],
  toObjectType: string
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < fromIds.length; i += 100) {
    const chunk = fromIds.slice(i, i + 100);
    const res = await hubspotFetch(
      `/crm/v4/associations/${encodeURIComponent(fromObjectType)}/${encodeURIComponent(toObjectType)}/batch/read`,
      { method: "POST", body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }) }
    );
    const json = await res.json();
    for (const entry of json.results ?? []) {
      const fromId = String(entry.from?.id ?? "");
      const toIds = (entry.to ?? []).map((t: { toObjectId: string | number }) => String(t.toObjectId));
      if (fromId) out.set(fromId, toIds);
    }
  }
  return out;
}

export type HubspotOwner = { ownerId: number; name: string; email: string | null; archived: boolean };

export async function listOwners(): Promise<HubspotOwner[]> {
  const [active, archived] = await Promise.all([fetchOwnerPage(false), fetchOwnerPage(true)]);
  return [...active, ...archived];
}

async function fetchOwnerPage(archived: boolean): Promise<HubspotOwner[]> {
  const owners: HubspotOwner[] = [];
  let after: string | undefined;
  do {
    const qs = new URLSearchParams({ limit: "500", archived: String(archived) });
    if (after) qs.set("after", after);
    const res = await hubspotFetch(`/crm/v3/owners?${qs.toString()}`, { method: "GET" });
    const json = await res.json();
    for (const o of json.results ?? []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || String(o.id);
      owners.push({ ownerId: Number(o.id), name, email: o.email ?? null, archived });
    }
    after = json.paging?.next?.after;
  } while (after);
  return owners;
}
