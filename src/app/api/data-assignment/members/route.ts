import { NextResponse } from "next/server";
import { listOwners } from "@/lib/hubspot";
import { getOwnerToAssignment } from "@/lib/rosterStore";
import { cached } from "@/lib/cache";
import type { SalesMember } from "@/lib/assignment/types";

/**
 * Assignment-target picker (Phase 27). Reuses the SAME roster/owner
 * primitives as /api/roster/people rather than a second roster system —
 * this just shapes the response for the target picker (adds ACTIVE/INACTIVE
 * status, which /api/roster/people's `Person` type doesn't expose).
 */
export async function GET() {
  const [owners, ownerToAssignment] = await Promise.all([
    cached("owners-list", 24 * 60 * 60 * 1000, listOwners),
    getOwnerToAssignment(),
  ]);

  const members: SalesMember[] = owners
    .filter((o) => o.name.trim().length > 0 && ownerToAssignment.has(o.ownerId))
    .map((o) => {
      const a = ownerToAssignment.get(o.ownerId)!;
      const member: SalesMember = {
        ownerIds: a.ownerIds,
        name: a.name,
        role: a.role,
        team: a.pod,
        status: o.archived ? "INACTIVE" : "ACTIVE",
      };
      return member;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ members });
}
