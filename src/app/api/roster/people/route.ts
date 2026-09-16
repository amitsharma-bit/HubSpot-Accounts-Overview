import { NextResponse } from "next/server";
import { listOwners } from "@/lib/hubspot";
import { getAllMembers, getAllTeams } from "@/lib/rosterStore";
import { cached } from "@/lib/cache";

/**
 * The HubSpot-user search used ONLY by the Control Center's "+ Add Member"
 * flow (Phase 15) — every real HubSpot owner, tagged with whatever dashboard
 * status they already have (or null if they've never been added). This is
 * deliberately NOT the list rendered in Control Center's main Team Members
 * section anymore — that reads the curated dashboard directory instead (see
 * /api/roster/members). Dumping every HubSpot user into the main list was
 * exactly the problem this split fixes.
 */
export type Person = {
  ownerId: number;
  name: string;
  email: string | null;
  onDashboard: boolean;
  teamName: string | null;
  role: string | null;
  status: "active" | "deactivated" | "removed" | null;
};

export async function GET() {
  const [owners, members, teams] = await Promise.all([
    cached("owners-list", 24 * 60 * 60 * 1000, listOwners),
    getAllMembers(),
    getAllTeams(),
  ]);

  const teamNameById = new Map(teams.map((t) => [t.teamId, t.teamName]));
  const memberByOwnerId = new Map<number, (typeof members)[number]>();
  for (const m of members) {
    if (m.hubspotOwnerId !== null) memberByOwnerId.set(m.hubspotOwnerId, m);
    for (const id of m.mergedOwnerIds ?? []) memberByOwnerId.set(id, m);
  }

  const people: Person[] = owners
    // Blank-name placeholder/system owner records carry no identity worth
    // showing in a people-to-assign list.
    .filter((o) => o.name.trim().length > 0)
    .map((o) => {
      const m = memberByOwnerId.get(o.ownerId);
      return {
        ownerId: o.ownerId,
        name: o.name,
        email: o.email,
        onDashboard: !!m,
        teamName: m ? teamNameById.get(m.teamId) ?? null : null,
        role: m?.role ?? null,
        status: m?.status ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ people });
}
