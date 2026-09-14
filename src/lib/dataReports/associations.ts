import { batchGetAssociations, batchReadObjects } from "../hubspot";
import { GROUP_OBJECT_TYPE } from "../assignment/propertyMap";

/**
 * Association-derived columns (Phase 15) — NOT simple Company properties.
 * Only ever called for the specific columns a report actually selected
 * (opt-in cost, per Phase 38) — never fetched for every row unconditionally.
 * Every call here is a real, standard HubSpot association read
 * (`/crm/v4/associations/.../batch/read`) or a light batch property read for
 * a display name — never a write.
 */

export type AssociationBundle = {
  dealIds: Map<string, string[]>;
  dealNames: Map<string, string>; // dealId -> dealname, for the "Associated Deal" (first/primary) display column
  contactIds: Map<string, string[]>;
  contactNames: Map<string, string>; // contactId -> "First Last" or email
  groupIds: Map<string, string[]>; // via the real p242626590_dealship_group_names association
};

export async function resolveAssociations(
  companyIds: string[],
  need: { deal: boolean; contact: boolean; group: boolean }
): Promise<AssociationBundle> {
  const bundle: AssociationBundle = { dealIds: new Map(), dealNames: new Map(), contactIds: new Map(), contactNames: new Map(), groupIds: new Map() };
  if (companyIds.length === 0) return bundle;

  if (need.deal) {
    bundle.dealIds = await batchGetAssociations("companies", companyIds, "deals");
    const allDealIds = Array.from(new Set(Array.from(bundle.dealIds.values()).flat()));
    const deals = await batchReadObjects("deals", allDealIds, ["dealname"]);
    for (const d of deals) bundle.dealNames.set(d.id, d.properties.dealname ?? d.id);
  }

  if (need.contact) {
    bundle.contactIds = await batchGetAssociations("companies", companyIds, "contacts");
    const allContactIds = Array.from(new Set(Array.from(bundle.contactIds.values()).flat()));
    const contacts = await batchReadObjects("contacts", allContactIds, ["firstname", "lastname", "email"]);
    for (const c of contacts) {
      const name = [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ").trim();
      bundle.contactNames.set(c.id, name || c.properties.email || c.id);
    }
  }

  if (need.group) {
    // Association direction is company -> group here (opposite of the Data
    // Assignment module's group -> company direction), same real object/type.
    bundle.groupIds = await batchGetAssociations("companies", companyIds, GROUP_OBJECT_TYPE);
  }

  return bundle;
}
