import { NextRequest, NextResponse } from "next/server";
import {
  getAllMembers,
  getAllTeams,
  addMember,
  updateMember,
  moveMember,
  updateMemberRole,
  deactivateMember,
  reactivateMember,
  removeMember,
  RosterError,
} from "@/lib/rosterStore";

export type MemberRow = {
  memberId: string;
  name: string;
  email: string | null;
  hubspotOwnerId: number | null;
  mergedOwnerIds: number[];
  teamId: string;
  teamName: string;
  role: string;
  status: "active" | "deactivated" | "removed";
  isMerged: boolean;
};

/**
 * The Control Center's main Team Members list (Phase 12/13) — the curated
 * dashboard directory, NOT every HubSpot user. `limit` accumulates
 * (25 -> 45 -> 65 -> ...) for "View More" rather than paging, matching the
 * requested behavior exactly.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const statusFilter = sp.get("status") ?? "active"; // active | deactivated | all
  const teamFilter = sp.get("team");
  const roleFilter = sp.get("role");
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(sp.get("limit") ?? 25) || 25, 500);

  const [members, teams] = await Promise.all([getAllMembers(), getAllTeams()]);
  const teamNameById = new Map(teams.map((t) => [t.teamId, t.teamName]));

  let rows: MemberRow[] = members
    .filter((m) => m.status !== "removed") // removed members are archived, not shown in any normal list
    .map((m) => ({
      memberId: m.memberId,
      name: m.name,
      email: m.email,
      hubspotOwnerId: m.hubspotOwnerId,
      mergedOwnerIds: m.mergedOwnerIds ?? [],
      teamId: m.teamId,
      teamName: teamNameById.get(m.teamId) ?? m.teamId,
      role: m.role,
      status: m.status as "active" | "deactivated",
      isMerged: (m.mergedOwnerIds ?? []).length > 0,
    }));

  if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
  if (teamFilter) rows = rows.filter((r) => r.teamId === teamFilter);
  if (roleFilter) rows = rows.filter((r) => r.role === roleFilter);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        String(r.hubspotOwnerId ?? "").includes(q) ||
        r.teamName.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
    );
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ total: rows.length, members: rows.slice(0, limit) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const member = await addMember({
      name: String(body.name ?? ""),
      email: body.email ?? null,
      hubspotOwnerId: Number(body.hubspotOwnerId),
      teamId: String(body.teamId ?? ""),
      role: String(body.role ?? ""),
    });
    return NextResponse.json({ member });
  } catch (err) {
    if (err instanceof RosterError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("add member failed:", err);
    return NextResponse.json({ error: "Failed to add member." }, { status: 500 });
  }
}

/**
 * body: { memberId, action, ... }
 *   update:       { name?, email? }
 *   move:         { teamId } (destination team)
 *   changeRole:   { role }
 *   deactivate:   { performedBy }
 *   reactivate:   (no extra fields)
 *   remove:       { performedBy } — soft archive, never deletes the record
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const memberId = String(body.memberId ?? "");
    if (!memberId) return NextResponse.json({ error: "memberId is required." }, { status: 400 });

    switch (body.action) {
      case "update": {
        const member = await updateMember(memberId, { name: body.name, email: body.email });
        return NextResponse.json({ member });
      }
      case "move": {
        const member = await moveMember(memberId, String(body.teamId ?? ""));
        return NextResponse.json({ member });
      }
      case "changeRole": {
        const member = await updateMemberRole(memberId, String(body.role ?? ""));
        return NextResponse.json({ member });
      }
      case "deactivate": {
        const member = await deactivateMember(memberId, String(body.performedBy ?? "Admin"));
        return NextResponse.json({ member });
      }
      case "reactivate": {
        const member = await reactivateMember(memberId);
        return NextResponse.json({ member });
      }
      case "remove": {
        const member = await removeMember(memberId, String(body.performedBy ?? "Admin"));
        return NextResponse.json({ member });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof RosterError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("member update failed:", err);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}
