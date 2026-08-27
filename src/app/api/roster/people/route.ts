import { NextResponse } from "next/server";
import { listOwners } from "@/lib/hubspot";
import { getOwnerToAssignment } from "@/lib/rosterStore";
import { UNASSIGNED_POD } from "@/config/roster";
import { cached } from "@/lib/cache";

export type Person = {
  ownerId: number;
  name: string;
  email: string | null;
  role: string | null;
  pod: string;
  source: "seed" | "manual" | null;
  isMerged: boolean;
};

export async function GET() {
  const [owners, ownerToAssignment] = await Promise.all([
    cached("owners-list", 24 * 60 * 60 * 1000, listOwners),
    getOwnerToAssignment(),
  ]);

  const people: Person[] = owners
    // Blank-name placeholder/system owner records carry no identity worth
    // showing in a people-to-assign list.
    .filter((o) => o.name.trim().length > 0)
    .map((o) => {
      const a = ownerToAssignment.get(o.ownerId);
      return {
        ownerId: o.ownerId,
        name: o.name,
        email: o.email,
        role: a?.role ?? null,
        pod: a?.pod ?? UNASSIGNED_POD,
        source: a?.source ?? null,
        isMerged: (a?.ownerIds.length ?? 0) > 1,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ people });
}
