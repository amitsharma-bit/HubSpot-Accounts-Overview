import { SYSTEM_OWNERS } from "@/config/roster";
import { getAssignments, getAssignedOwnerIds, getPods } from "./rosterStore";
import { listOwners } from "./hubspot";
import type { OwnerCountsResult, TeamTotal, MemberTotal, UnmappedOwner } from "./types";

// "Pod" (rosterStore.ts's Assignment.pod, a backward-compatible adapter over
// the dashboard team/member directory in data/dashboardDirectory.json) is
// the same concept the rest of this app calls "team" — kept as `team` in
// these return shapes so Overview needs no changes here. getAssignments()
// already only returns ACTIVE members on an ACTIVE team, so a deactivated
// member or an archived team disappears from these totals automatically.

export async function memberTotals(ownerCounts: OwnerCountsResult): Promise<MemberTotal[]> {
  const assignments = await getAssignments();
  return assignments.map((a) => ({
    ownerIds: a.ownerIds,
    name: a.name,
    role: a.role,
    team: a.pod,
    accountCount: a.ownerIds.reduce((sum, id) => sum + (ownerCounts.counts[id] ?? 0), 0),
    isMerged: a.ownerIds.length > 1,
    note: a.note,
  }));
}

export async function teamTotals(ownerCounts: OwnerCountsResult): Promise<TeamTotal[]> {
  const [pods, members] = await Promise.all([getPods(), memberTotals(ownerCounts)]);
  return pods.map((pod) => {
    const podMembers = members.filter((m) => m.team === pod);
    const roleBreakdown: Record<string, number> = {};
    for (const m of podMembers) roleBreakdown[m.role] = (roleBreakdown[m.role] ?? 0) + m.accountCount;
    return {
      team: pod,
      accountCount: podMembers.reduce((sum, m) => sum + m.accountCount, 0),
      memberCount: podMembers.length,
      roleBreakdown,
    };
  });
}

export async function roleTotals(ownerCounts: OwnerCountsResult): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of await memberTotals(ownerCounts)) out[m.role] = (out[m.role] ?? 0) + m.accountCount;
  return out;
}

export function systemBucketTotals(ownerCounts: OwnerCountsResult): { ownerId: number; name: string; count: number }[] {
  return Object.entries(SYSTEM_OWNERS)
    .map(([id, name]) => ({ ownerId: Number(id), name, count: ownerCounts.counts[Number(id)] ?? 0 }))
    .filter((b) => b.count > 0);
}

/**
 * Every HubSpot owner who has >=1 US company but is neither assigned in the
 * roster store nor a known system bucket. Never silently dropped — this is
 * the whole point.
 */
export async function unmappedOwners(ownerCounts: OwnerCountsResult): Promise<UnmappedOwner[]> {
  const [owners, assignedIds] = await Promise.all([listOwners(), getAssignedOwnerIds()]);
  const ownerById = new Map(owners.map((o) => [o.ownerId, o]));
  const systemIds = new Set(Object.keys(SYSTEM_OWNERS).map(Number));

  return Object.entries(ownerCounts.counts)
    .map(([idStr]) => Number(idStr))
    .filter((id) => !assignedIds.has(id) && !systemIds.has(id))
    .map((id) => ({
      ownerId: id,
      name: ownerById.get(id)?.name ?? `Owner ${id}`,
      archived: ownerById.get(id)?.archived ?? false,
      count: ownerCounts.counts[id],
    }))
    .sort((a, b) => b.count - a.count);
}
