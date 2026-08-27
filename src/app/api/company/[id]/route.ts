import { NextRequest, NextResponse } from "next/server";
import { getCompanyById, getAccountInfo, listOwners } from "@/lib/hubspot";
import { COUNTRY_PROPERTY, STATE_PROPERTY, normalizeGroupFlag } from "@/lib/filters";
import { resolveOptionLabel } from "@/lib/propertyLabels";
import { getOwnerToAssignment } from "@/lib/rosterStore";
import { SYSTEM_OWNERS } from "@/config/roster";
import { cached } from "@/lib/cache";
import type { CompanyDetail } from "@/lib/types";

const PROPERTIES = [
  "name",
  "domain",
  "hubspot_owner_id",
  "hubspot_team_id",
  "lifecyclestage",
  "lifecycle_stage_gd_level",
  "number_of_used_cars",
  "potential_rooftops",
  "gd_name",
  "gd_id",
  "is_this_is_a_part_of_group_dealership_",
  "num_associated_contacts",
  "rooftop_last_activity",
  "hubspot_owner_assigneddate",
  COUNTRY_PROPERTY,
  STATE_PROPERTY,
];

// HubSpot's Company object type ID ("0-2") is a stable, publicly documented
// CRM constant — not portal-specific — unlike the portal ID and UI domain,
// which are fetched live rather than hardcoded (a portal can be on a
// different data-center subdomain, e.g. app-na2.hubspot.com here).
const COMPANY_OBJECT_TYPE_ID = "0-2";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [company, accountInfo, owners, ownerToAssignment] = await Promise.all([
    getCompanyById(id, PROPERTIES),
    cached("account-info", 24 * 60 * 60 * 1000, getAccountInfo),
    cached("owners-list", 24 * 60 * 60 * 1000, listOwners),
    getOwnerToAssignment(),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const ownerId = company.properties.hubspot_owner_id ? Number(company.properties.hubspot_owner_id) : null;
  const ownerNameById = new Map(owners.map((o) => [o.ownerId, o.name]));
  const ownerName = ownerId ? ownerNameById.get(ownerId) ?? SYSTEM_OWNERS[ownerId] ?? `Owner ${ownerId}` : null;
  const assignment = ownerId ? ownerToAssignment.get(ownerId) : undefined;

  const lifecycleStage = await resolveOptionLabel("lifecyclestage", company.properties.lifecyclestage);

  const usedCars = company.properties.number_of_used_cars ? Number(company.properties.number_of_used_cars) : null;
  const rooftops = company.properties.potential_rooftops ? Number(company.properties.potential_rooftops) : null;
  const contacts = company.properties.num_associated_contacts ? Number(company.properties.num_associated_contacts) : null;

  const body: CompanyDetail = {
    id: company.id,
    name: company.properties.name,
    domain: company.properties.domain,
    ownerName,
    team: assignment?.pod ?? null,
    role: assignment?.role ?? null,
    lifecycleStage,
    // hubspot_team_id (HubSpot's native Teams feature, distinct from this
    // app's roster "pod") can't be resolved to a friendly name — that needs
    // the settings.users.teams.read scope, which this private app token
    // doesn't have. Shown as the raw ID rather than guessed.
    hubspotTeamId: company.properties.hubspot_team_id,
    gdLevel: company.properties.lifecycle_stage_gd_level,
    numberOfUsedCars: usedCars !== null && !Number.isNaN(usedCars) ? usedCars : null,
    potentialRooftops: rooftops !== null && !Number.isNaN(rooftops) ? rooftops : null,
    gdName: company.properties.gd_name,
    gdId: company.properties.gd_id,
    inGroupDealership: normalizeGroupFlag(company.properties.is_this_is_a_part_of_group_dealership_),
    numAssociatedContacts: contacts !== null && !Number.isNaN(contacts) ? contacts : null,
    lastActivityDate: company.properties.rooftop_last_activity,
    ownerAssignedDate: company.properties.hubspot_owner_assigneddate,
    hubspotUrl: `https://${accountInfo.uiDomain}/contacts/${accountInfo.portalId}/record/${COMPANY_OBJECT_TYPE_ID}/${company.id}`,
  };
  return NextResponse.json(body);
}
