import { OWNER_TO_MEMBER, ROSTER, ROSTER_OWNER_IDS, SYSTEM_OWNERS, TEAMS } from "@/config/roster";
import { listOwners } from "./hubspot";
import type { OwnerCountsResult, TeamTotal, MemberTotal, UnmappedOwner } from "./types";

export function memberTotals(ownerCounts: OwnerCountsResult): MemberTotal[] {
  return ROSTER.map((member) => ({
    ownerIds: member.ownerIds,
    name: member.name,
    role: member.role,
    team: member.team,
    accountCount: member.ownerIds.reduce((sum, id) => sum + (ownerCounts.counts[id] ?? 0), 0),
    isMerged: member.ownerIds.length > 1,
    note: member.note,
  }));
}

export function teamTotals(ownerCounts: OwnerCountsResult): TeamTotal[] {
  const members = memberTotals(ownerCounts);
  return TEAMS.map((team) => {
    const teamMembers = members.filter((m) => m.team === team);
    const roleBreakdown: Record<string, number> = {};
    for (const m of teamMembers) roleBreakdown[m.role] = (roleBreakdown[m.role] ?? 0) + m.accountCount;
    return {
      team,
      accountCount: teamMembers.reduce((sum, m) => sum + m.accountCount, 0),
      memberCount: teamMembers.length,
      roleBreakdown,
    };
  });
}

export function roleTotals(ownerCounts: OwnerCountsResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of memberTotals(ownerCounts)) out[m.role] = (out[m.role] ?? 0) + m.accountCount;
  return out;
}

export function systemBucketTotals(ownerCounts: OwnerCountsResult): { ownerId: number; name: string; count: number }[] {
  return Object.entries(SYSTEM_OWNERS)
    .map(([id, name]) => ({ ownerId: Number(id), name, count: ownerCounts.counts[Number(id)] ?? 0 }))
    .filter((b) => b.count > 0);
}

/**
 * Every HubSpot owner who has >=1 US company but is neither on the roster nor
 * a known system bucket. Never silently dropped — this is the whole point.
 */
export async function unmappedOwners(ownerCounts: OwnerCountsResult): Promise<UnmappedOwner[]> {
  const owners = await listOwners();
  const ownerById = new Map(owners.map((o) => [o.ownerId, o]));
  const systemIds = new Set(Object.keys(SYSTEM_OWNERS).map(Number));

  return Object.entries(ownerCounts.counts)
    .map(([idStr]) => Number(idStr))
    .filter((id) => !ROSTER_OWNER_IDS.has(id) && !systemIds.has(id))
    .map((id) => ({
      ownerId: id,
      name: ownerById.get(id)?.name ?? `Owner ${id}`,
      archived: ownerById.get(id)?.archived ?? false,
      count: ownerCounts.counts[id],
    }))
    .sort((a, b) => b.count - a.count);
}

export function isRosterOwner(ownerId: number): boolean {
  return OWNER_TO_MEMBER.has(ownerId);
}
