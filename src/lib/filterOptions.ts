import { countCompanies, getCompanyProperties } from "./hubspot";
import { COUNTRY_PROPERTY, STATE_PROPERTY, countryFilter, DEFAULT_COUNTRY } from "./filters";
import { cached } from "./cache";
import { redis } from "./redis";
import type { PropertyFilter } from "./types";

export type FilterOption = { value: string; count: number };

// These almost never change (a new HubSpot value showing up is rare), so a
// long Redis TTL is fine — this isn't part of the hourly refresh job, it's
// computed lazily on first request and then reused for a week. Layered under
// the usual in-memory cache too, so a warm instance doesn't even round-trip
// to Redis on every call.
const MEMORY_TTL_MS = 30 * 60 * 1000;
const REDIS_TTL_S = 7 * 24 * 60 * 60;
const CONCURRENCY = 8;

async function cachedPersistent<T>(key: string, compute: () => Promise<T>): Promise<T> {
  return cached(`filter-options:mem:${key}`, MEMORY_TTL_MS, async () => {
    const fromRedis = await redis.get<T>(key);
    if (fromRedis) return fromRedis;
    const value = await compute();
    await redis.set(key, value, { ex: REDIS_TTL_S });
    return value;
  });
}

async function countOptions(propertyName: string, options: string[], scopeFilter?: PropertyFilter) {
  const results: FilterOption[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < options.length) {
      const value = options[cursor++];
      const filters = scopeFilter
        ? [scopeFilter, { propertyName, operator: "EQ" as const, value }]
        : [{ propertyName, operator: "EQ" as const, value }];
      const count = await countCompanies([{ filters }]);
      if (count > 0) results.push({ value, count });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.sort((a, b) => b.count - a.count);
}

/** Every country_dropdown option that actually has ≥1 company — not the raw 80-option enum list. */
export async function getCountryOptions(): Promise<FilterOption[]> {
  return cachedPersistent("filter-options:countries", async () => {
    const props = await getCompanyProperties();
    const prop = props.find((p) => p.name === COUNTRY_PROPERTY);
    if (!prop) return [];
    return countOptions(COUNTRY_PROPERTY, prop.options.map((o) => o.value));
  });
}

/** Every state_drop_down option that actually has ≥1 company for the given country. */
export async function getStateOptions(country: string = DEFAULT_COUNTRY): Promise<FilterOption[]> {
  return cachedPersistent(`filter-options:states:${country}`, async () => {
    const props = await getCompanyProperties();
    const prop = props.find((p) => p.name === STATE_PROPERTY);
    if (!prop) return [];
    return countOptions(STATE_PROPERTY, prop.options.map((o) => o.value), countryFilter(country));
  });
}
