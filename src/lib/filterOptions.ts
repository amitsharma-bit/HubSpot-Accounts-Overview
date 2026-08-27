import { countCompanies, getCompanyProperties } from "./hubspot";
import { COUNTRY_PROPERTY, STATE_PROPERTY, countryFilter, DEFAULT_COUNTRY } from "./filters";
import { cached } from "./cache";
import type { PropertyFilter } from "./types";

export type FilterOption = { value: string; count: number };

const OPTIONS_TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;

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
  return cached("filter-options:countries", OPTIONS_TTL_MS, async () => {
    const props = await getCompanyProperties();
    const prop = props.find((p) => p.name === COUNTRY_PROPERTY);
    if (!prop) return [];
    return countOptions(COUNTRY_PROPERTY, prop.options.map((o) => o.value));
  });
}

/** Every state_drop_down option that actually has ≥1 company for the given country. */
export async function getStateOptions(country: string = DEFAULT_COUNTRY): Promise<FilterOption[]> {
  return cached(`filter-options:states:${country}`, OPTIONS_TTL_MS, async () => {
    const props = await getCompanyProperties();
    const prop = props.find((p) => p.name === STATE_PROPERTY);
    if (!prop) return [];
    return countOptions(STATE_PROPERTY, prop.options.map((o) => o.value), countryFilter(country));
  });
}
