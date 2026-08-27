import { NextRequest, NextResponse } from "next/server";
import { scanCompanies, listOwners } from "@/lib/hubspot";
import { SYSTEM_OWNERS } from "@/config/roster";
import { cached } from "@/lib/cache";
import type { GroupDetail, GroupCompanyRow } from "@/lib/types";

const PROPERTIES = [
  "name",
  "domain",
  "hubspot_owner_id",
  "hubspot_owner_assigneddate",
  "rooftop_last_activity",
  "potential_rooftops",
  "num_associated_contacts",
  "gd_name",
  "gd_stage_sync",
];

export const maxDuration = 60;

/**
 * There is no separate "Dealership Group" HubSpot object (verified:
 * hs_parent_company_id has zero adoption in this portal) — a group is just
 * every Company record sharing the same gd_id. So "group detail" means
 * scanning all companies with that gd_id, not fetching one record. Bounded
 * by real dealer-group sizes (a handful to a few dozen rooftops), not the
 * ~24k companies that have *some* gd_id across the whole portal.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ gdId: string }> }) {
  const { gdId } = await params;

  const owners = await cached("owners-list", 24 * 60 * 60 * 1000, listOwners);
  const ownerNameById = new Map(owners.map((o) => [o.ownerId, o.name]));

  const seen = new Set<string>();
  const rows: GroupCompanyRow[] = [];
  let gdName: string | null = null;
  let gdStage: string | null = null;
  let totalContacts = 0;
  let totalPotentialRooftops = 0;
  let gdLastActivityDate: string | null = null;

  for await (const batch of scanCompanies([{ filters: [{ propertyName: "gd_id", operator: "EQ", value: gdId }] }], PROPERTIES)) {
    for (const r of batch) {
      if (seen.has(r.id)) continue; // dedupe by HubSpot Company Record ID
      seen.add(r.id);

      gdName ??= r.properties.gd_name;
      gdStage ??= r.properties.gd_stage_sync;

      const ownerId = r.properties.hubspot_owner_id ? Number(r.properties.hubspot_owner_id) : null;
      const ownerName = ownerId ? ownerNameById.get(ownerId) ?? SYSTEM_OWNERS[ownerId] ?? `Owner ${ownerId}` : null;
      const rooftops = r.properties.potential_rooftops ? Number(r.properties.potential_rooftops) : null;
      const contacts = r.properties.num_associated_contacts ? Number(r.properties.num_associated_contacts) : null;

      if (rooftops !== null && !Number.isNaN(rooftops)) totalPotentialRooftops += rooftops;
      if (contacts !== null && !Number.isNaN(contacts)) totalContacts += contacts;

      const lastActivity = r.properties.rooftop_last_activity;
      if (lastActivity && (!gdLastActivityDate || new Date(lastActivity) > new Date(gdLastActivityDate))) {
        gdLastActivityDate = lastActivity;
      }

      rows.push({
        id: r.id,
        name: r.properties.name,
        domain: r.properties.domain,
        ownerName,
        ownerAssignedDate: r.properties.hubspot_owner_assigneddate,
        lastActivityDate: lastActivity,
        potentialRooftops: rooftops !== null && !Number.isNaN(rooftops) ? rooftops : null,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No companies found for this dealership group." }, { status: 404 });
  }

  const body: GroupDetail = {
    gdId,
    gdName,
    gdStage,
    gdLastActivityDate,
    totalContacts,
    totalCompanies: rows.length,
    totalPotentialRooftops,
    companies: rows,
  };
  return NextResponse.json(body);
}
