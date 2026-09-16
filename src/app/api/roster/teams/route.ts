import { NextRequest, NextResponse } from "next/server";
import { addTeam, updateTeam, archiveTeam, reactivateTeam, moveAllMembers, RosterError } from "@/lib/rosterStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const team = await addTeam({ teamName: String(body.teamName ?? ""), managerId: body.managerId ?? null });
    return NextResponse.json({ team });
  } catch (err) {
    if (err instanceof RosterError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("add team failed:", err);
    return NextResponse.json({ error: "Failed to add team." }, { status: 500 });
  }
}

/**
 * body: { teamId, action: "update" | "archive" | "reactivate" | "moveMembers", ... }
 *   update:       { teamName?, managerId? }
 *   archive:      { force?: boolean } — without force, refuses (400) if the team has active members
 *   reactivate:   (no extra fields)
 *   moveMembers:  { toTeamId } — moves every active member out of teamId into toTeamId
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const teamId = String(body.teamId ?? "");
    if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });

    switch (body.action) {
      case "update": {
        const team = await updateTeam(teamId, { teamName: body.teamName, managerId: body.managerId });
        return NextResponse.json({ team });
      }
      case "archive": {
        const { team, activeMemberCount } = await archiveTeam(teamId, { force: !!body.force });
        return NextResponse.json({ team, activeMemberCount });
      }
      case "reactivate": {
        const team = await reactivateTeam(teamId);
        return NextResponse.json({ team });
      }
      case "moveMembers": {
        const toTeamId = String(body.toTeamId ?? "");
        if (!toTeamId) return NextResponse.json({ error: "toTeamId is required." }, { status: 400 });
        const count = await moveAllMembers(teamId, toTeamId);
        return NextResponse.json({ movedCount: count });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof RosterError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("team update failed:", err);
    return NextResponse.json({ error: "Failed to update team." }, { status: 500 });
  }
}
