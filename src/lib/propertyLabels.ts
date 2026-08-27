import { getCompanyProperties } from "./hubspot";
import { cached } from "./cache";

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `lifecyclestage` in this portal has custom stages layered on top of
 * HubSpot's 6 defaults (e.g. raw value "1816032986" -> label "Prospect") —
 * verified live. Resolving these requires the property's real `options`
 * list, not a hardcoded map, since custom stage IDs are portal-specific and
 * would silently go stale otherwise.
 */
async function getPropertyOptionsMap(propertyName: string): Promise<Map<string, string>> {
  return cached(`property-options:${propertyName}`, TTL_MS, async () => {
    const props = await getCompanyProperties();
    const prop = props.find((p) => p.name === propertyName);
    return new Map((prop?.options ?? []).map((o) => [o.value, o.label]));
  });
}

export async function resolveOptionLabel(propertyName: string, rawValue: string | null | undefined): Promise<string | null> {
  if (!rawValue) return null;
  const options = await getPropertyOptionsMap(propertyName);
  return options.get(rawValue) ?? rawValue;
}
