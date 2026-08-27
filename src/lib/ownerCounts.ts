import { getJSON, setJSON } from "./redis";
import { countCompanies, listOwners } from "./hubspot";
import { countryFilter, dealershipClassFilters, STATE_PROPERTY, scopeCacheKey, isDefaultScope } from "./filters";
import { cached, invalidate } from "./cache";
import type { OwnerCountsResult, FilterScope, PropertyFilter } from "./types";

const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MEMORY_TTL_MS = 30 * 60 * 1000;

/**
 * Bumped whenever the meaning of "default scope" changes (e.g. which HubSpot
 * property counts as country) — baked directly into the Redis key so an old
 * snapshot from before the change is simply never read, rather than relying
 * on an age check to catch it. Caught live on 2026-08-27 switching country ->
 * country_dropdown: the old disk-based snapshot kept serving the pre-switch
 * ~67k total while every other endpoint had already moved to ~120k, because
 * "is this snapshot stale" only checked age, not whether the logic that
 * produced it was still current.
 */
const SNAPSHOT_SCHEMA_VERSION = 2;
const SNAPSHOT_KEY = `owner-counts:snapshot:v${SNAPSHOT_SCHEMA_VERSION}`;

function scopeFilters(scope: FilterScope): PropertyFilter[] {
  const filters: PropertyFilter[] = [countryFilter(scope.country)];
  if (scope.state) filters.push({ propertyName: STATE_PROPERTY, operator: "EQ", value: scope.state });
  if (scope.city) filters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: scope.city });
  if (scope.dealershipClass) filters.push(...dealershipClassFilters(scope.dealershipClass));
  return filters;
}

// Only the default scope (Country=United States, no other filters) gets a
// Redis-backed warm-start snapshot — that's the view everyone lands on, and
// the one the hourly /api/refresh job keeps warm. Any other filter
// combination the sidebar produces just uses the 30-minute in-memory cache;
// ponytail: don't persist every possible filter combination.
async function readSnapshot(): Promise<OwnerCountsResult | null> {
  const parsed = await getJSON<OwnerCountsResult>(SNAPSHOT_KEY);
  if (!parsed) return null;
  if (Date.now() - new Date(parsed.computedAt).getTime() < SNAPSHOT_MAX_AGE_MS) return parsed;
  return null;
}

async function writeSnapshot(result: OwnerCountsResult): Promise<void> {
  await setJSON(SNAPSHOT_KEY, result);
}

/**
 * The load-bearing aggregate: one count-only search per known HubSpot owner
 * (there is no public GROUP BY endpoint), plus one for unowned and one grand
 * total, all scoped by the currently-applied sidebar filters. The
 * reconciliation identity `sum(counts) + unowned === total` is the proof
 * nothing was double-counted or dropped — see scripts/check.ts and
 * /api/validate, which both depend on this holding for every scope.
 */
async function computeOwnerCounts(scope: FilterScope): Promise<OwnerCountsResult> {
  const base = scopeFilters(scope);
  const owners = await listOwners();
  const counts: Record<number, number> = {};

  // Sequential-ish with a small concurrency window; hubspot.ts already rate-gates.
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < owners.length) {
      const owner = owners[cursor++];
      const n = await countCompanies([
        { filters: [...base, { propertyName: "hubspot_owner_id", operator: "EQ", value: String(owner.ownerId) }] },
      ]);
      if (n > 0) counts[owner.ownerId] = n;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const [unowned, total] = await Promise.all([
    countCompanies([{ filters: [...base, { propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }]),
    countCompanies([{ filters: base }]),
  ]);

  const result: OwnerCountsResult = { counts, unowned, total, computedAt: new Date().toISOString() };
  if (isDefaultScope(scope)) {
    await writeSnapshot(result).catch(() => {
      // best-effort warm-start cache; failing to write it just means a cold recompute next time
    });
  }
  return result;
}

export async function getOwnerCounts(scope: FilterScope = {}, forceRefresh = false): Promise<OwnerCountsResult> {
  const key = `owner-counts:${scopeCacheKey(scope)}`;
  // A cache hit short-circuits before the compute callback below ever runs,
  // so forceRefresh has to invalidate first — otherwise /api/refresh calling
  // this within the 30-minute in-memory window would silently return the
  // stale cached promise instead of actually recomputing.
  if (forceRefresh) invalidate(key);
  return cached(key, MEMORY_TTL_MS, async () => {
    if (!forceRefresh && isDefaultScope(scope)) {
      const snapshot = await readSnapshot();
      if (snapshot) return snapshot;
    }
    return computeOwnerCounts(scope);
  });
}

export function reconcile(result: OwnerCountsResult): { pass: boolean; delta: number } {
  const sum = Object.values(result.counts).reduce((a, b) => a + b, 0);
  const delta = result.total - (sum + result.unowned);
  return { pass: delta === 0, delta };
}
