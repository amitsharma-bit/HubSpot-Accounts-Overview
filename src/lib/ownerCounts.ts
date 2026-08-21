import { promises as fs } from "fs";
import path from "path";
import { countCompanies, listOwners } from "./hubspot";
import { COUNTRY_FILTER } from "./filters";
import { cached } from "./cache";
import type { OwnerCountsResult } from "./types";

const SNAPSHOT_PATH = path.join(process.cwd(), ".cache", "owner-counts.json");
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MEMORY_TTL_MS = 30 * 60 * 1000;

async function readSnapshot(): Promise<OwnerCountsResult | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as OwnerCountsResult;
    if (Date.now() - new Date(parsed.computedAt).getTime() < SNAPSHOT_MAX_AGE_MS) return parsed;
  } catch {
    // no snapshot yet, or unreadable — compute fresh
  }
  return null;
}

async function writeSnapshot(result: OwnerCountsResult): Promise<void> {
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(result), "utf8");
}

/**
 * The load-bearing aggregate: one count-only search per known HubSpot owner
 * (there is no public GROUP BY endpoint), plus one for unowned and one grand
 * total. The reconciliation identity `sum(counts) + unowned === total` is the
 * proof nothing was double-counted or dropped — see scripts/check.ts and
 * /api/validate, which both depend on this holding.
 */
async function computeOwnerCounts(): Promise<OwnerCountsResult> {
  const owners = await listOwners();
  const counts: Record<number, number> = {};

  // Sequential-ish with a small concurrency window; hubspot.ts already rate-gates.
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < owners.length) {
      const owner = owners[cursor++];
      const n = await countCompanies([
        { filters: [COUNTRY_FILTER, { propertyName: "hubspot_owner_id", operator: "EQ", value: String(owner.ownerId) }] },
      ]);
      if (n > 0) counts[owner.ownerId] = n;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const [unowned, total] = await Promise.all([
    countCompanies([{ filters: [COUNTRY_FILTER, { propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" }] }]),
    countCompanies([{ filters: [COUNTRY_FILTER] }]),
  ]);

  const result: OwnerCountsResult = { counts, unowned, total, computedAt: new Date().toISOString() };
  await writeSnapshot(result).catch(() => {
    // best-effort warm-start cache; failing to write it just means a cold recompute next time
  });
  return result;
}

export async function getOwnerCounts(forceRefresh = false): Promise<OwnerCountsResult> {
  return cached("owner-counts", MEMORY_TTL_MS, async () => {
    if (!forceRefresh) {
      const snapshot = await readSnapshot();
      if (snapshot) return snapshot;
    }
    return computeOwnerCounts();
  });
}

export function reconcile(result: OwnerCountsResult): { pass: boolean; delta: number } {
  const sum = Object.values(result.counts).reduce((a, b) => a + b, 0);
  const delta = result.total - (sum + result.unowned);
  return { pass: delta === 0, delta };
}
