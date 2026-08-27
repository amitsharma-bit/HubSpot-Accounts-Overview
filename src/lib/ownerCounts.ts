import { promises as fs } from "fs";
import path from "path";
import { countCompanies, listOwners } from "./hubspot";
import { countryFilter, dealershipClassFilters, STATE_PROPERTY, scopeCacheKey, isDefaultScope } from "./filters";
import { cached } from "./cache";
import type { OwnerCountsResult, FilterScope, PropertyFilter } from "./types";

const SNAPSHOT_PATH = path.join(process.cwd(), ".cache", "owner-counts.json");
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MEMORY_TTL_MS = 30 * 60 * 1000;

/**
 * Bumped whenever the meaning of "default scope" changes (e.g. which HubSpot
 * property counts as country). A snapshot written under an old signature is
 * silently wrong, not just stale — age alone can't catch that, since a
 * logic change can happen well inside the 24h window. Caught live on
 * 2026-08-27 switching country -> country_dropdown: the disk snapshot kept
 * serving the pre-switch ~67k total while every other endpoint had already
 * moved to ~120k.
 */
const SNAPSHOT_SCHEMA_VERSION = 2;

function scopeFilters(scope: FilterScope): PropertyFilter[] {
  const filters: PropertyFilter[] = [countryFilter(scope.country)];
  if (scope.state) filters.push({ propertyName: STATE_PROPERTY, operator: "EQ", value: scope.state });
  if (scope.city) filters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: scope.city });
  if (scope.dealershipClass) filters.push(...dealershipClassFilters(scope.dealershipClass));
  return filters;
}

// Only the default scope (Country=United States, no other filters) gets a
// disk-backed warm-start snapshot — that's the view everyone lands on, and
// the only one worth surviving a dev restart. Any other filter combination
// the sidebar produces just uses the 30-minute in-memory cache; ponytail:
// don't persist every possible filter combination to disk.
type Snapshot = OwnerCountsResult & { schemaVersion: number };

async function readSnapshot(): Promise<OwnerCountsResult | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null;
    if (Date.now() - new Date(parsed.computedAt).getTime() < SNAPSHOT_MAX_AGE_MS) return parsed;
  } catch {
    // no snapshot yet, or unreadable — compute fresh
  }
  return null;
}

async function writeSnapshot(result: OwnerCountsResult): Promise<void> {
  const snapshot: Snapshot = { ...result, schemaVersion: SNAPSHOT_SCHEMA_VERSION };
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot), "utf8");
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
  return cached(`owner-counts:${scopeCacheKey(scope)}`, MEMORY_TTL_MS, async () => {
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
