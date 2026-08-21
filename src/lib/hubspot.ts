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
    throw new Error(`HubSpot ${path} failed: ${res.status} ${body}`);
  }
  return res;
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

const ACCOUNTS_PAGE_SIZE = 100;
const HUBSPOT_SEARCH_ROW_CAP = 10_000;

export async function searchCompanies(
  filterGroups: FilterGroup[],
  page: number,
  properties: string[]
): Promise<{ total: number; results: { id: string; properties: Record<string, string | null> }[] }> {
  if ((page - 1) * ACCOUNTS_PAGE_SIZE >= HUBSPOT_SEARCH_ROW_CAP) throw new PageBeyondLimitError();
  return search({
    filterGroups,
    properties,
    limit: ACCOUNTS_PAGE_SIZE,
    after: String((page - 1) * ACCOUNTS_PAGE_SIZE),
    sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
  });
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
        limit: ACCOUNTS_PAGE_SIZE,
        after: String(after),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      });
      if (page.results.length === 0) break;
      sawAny = true;
      yield page.results;
      lastId = page.results[page.results.length - 1].id;
      after += ACCOUNTS_PAGE_SIZE;
      if (after >= HUBSPOT_SEARCH_ROW_CAP) break;
    }
    if (!sawAny) break;
  }
}

export type HubspotOwner = { ownerId: number; name: string; archived: boolean };

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
      owners.push({ ownerId: Number(o.id), name, archived });
    }
    after = json.paging?.next?.after;
  } while (after);
  return owners;
}
