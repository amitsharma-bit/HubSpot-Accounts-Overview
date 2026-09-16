import { NextResponse } from "next/server";
import { getAllTeams, getAllMembers } from "@/lib/rosterStore";

/** Full admin directory (every team/member, any status) — Control Center's initial load. */
export async function GET() {
  const [teams, members] = await Promise.all([getAllTeams(), getAllMembers()]);
  return NextResponse.json({ teams, members });
}
