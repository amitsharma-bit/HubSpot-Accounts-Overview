import { NextRequest, NextResponse } from "next/server";
import { getAssignments, getPods, upsertAssignment } from "@/lib/rosterStore";
import { ROLE_ORDER } from "@/config/roster";
import type { Role } from "@/config/roster";

export async function GET() {
  const [assignments, pods] = await Promise.all([getAssignments(), getPods()]);
  return NextResponse.json({ assignments, pods });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ownerId = Number(body.ownerId);
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "") as Role;
  const pod = String(body.pod ?? "").trim();

  if (!ownerId || Number.isNaN(ownerId)) {
    return NextResponse.json({ error: "ownerId is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (!ROLE_ORDER.includes(role)) {
    return NextResponse.json({ error: `role must be one of ${ROLE_ORDER.join(", ")}.` }, { status: 400 });
  }
  if (!pod) {
    return NextResponse.json({ error: "pod is required." }, { status: 400 });
  }

  const assignment = await upsertAssignment({ ownerId, name, role, pod });
  return NextResponse.json({ assignment });
}
