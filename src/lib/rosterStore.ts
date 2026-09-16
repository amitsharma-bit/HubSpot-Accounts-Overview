import { promises as fs } from "fs";
import path from "path";
import { getJSON, setJSON } from "./redis";
import { isValidRole, type Role } from "@/config/roster";

/**
 * ARCHITECTURE: HubSpot users vs. dashboard members. These are two different
 * concepts, deliberately kept apart:
 *
 *   HubSpot Owners (src/lib/hubspot.ts's listOwners()) — every real HubSpot
 *   user, including ones this dashboard has no opinion about.
 *
 *   Dashboard Members (this file) — a small, admin-curated directory of who
 *   actually appears in Control Center/Overview/Data Assignment/Data
 *   Reports. A HubSpot user can exist without being a dashboard member; a
 *   dashboard member can be deactivated without touching their HubSpot
 *   record, ownership, or historical data at all.
 *
 * Deactivating or removing a member here NEVER calls a HubSpot write
 * endpoint — it only changes this store's own `status` field. See
 * deactivateMember()/removeMember() below.
 */

export type MemberStatus = "active" | "deactivated" | "removed";
export type TeamStatus = "active" | "archived";

export type DashboardTeam = {
  teamId: string;
  teamName: string;
  status: TeamStatus;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMember = {
  memberId: string;
  name: string;
  email: string | null;
  /** The primary real HubSpot owner ID — null means "not yet mapped," never guessed. */
  hubspotOwnerId: number | null;
  /** Extra HubSpot owner IDs that roll up to this same human (e.g. a legacy duplicate record). */
  mergedOwnerIds?: number[];
  teamId: string;
  /** "Not Configured" is a data state for a member whose real role wasn't provided — not a 4th role option. */
  role: Role | "Not Configured";
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  removedAt?: string;
  removedBy?: string;
  note?: string;
};

type Store = { teams: DashboardTeam[]; members: DashboardMember[] };

// A fresh Redis key on purpose — this is an intentional, one-time reset of
// the team/member directory (the old roster:v1's pod-based shape doesn't
// carry the active/deactivated/removed status or team-as-its-own-entity
// model this needs), not a migration of the old data. data/roster.json (the
// old seed) is now inert; data/dashboardDirectory.json is the new one-time
// seed for a brand-new, empty store.
const DIRECTORY_KEY = "dashboard:directory:v1";
const SEED_PATH = path.join(process.cwd(), "data", "dashboardDirectory.json");

let memo: Store | null = null;

function ownerIdsOf(m: Pick<DashboardMember, "hubspotOwnerId" | "mergedOwnerIds">): number[] {
  return [m.hubspotOwnerId, ...(m.mergedOwnerIds ?? [])].filter((id): id is number => id !== null && id !== undefined);
}

async function readSeed(): Promise<Store> {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  const parsed = JSON.parse(raw) as { teams: DashboardTeam[]; members: (DashboardMember & { createdAt?: string; updatedAt?: string })[] };
  const now = new Date().toISOString();
  return {
    teams: parsed.teams,
    members: parsed.members.map((m) => ({ ...m, createdAt: m.createdAt ?? now, updatedAt: m.updatedAt ?? now })),
  };
}

async function readStore(): Promise<Store> {
  if (memo) return memo;
  const raw = await getJSON<Store>(DIRECTORY_KEY);
  if (raw) {
    memo = raw;
    return raw;
  }
  const seed = await readSeed();
  await setJSON(DIRECTORY_KEY, seed);
  memo = seed;
  return seed;
}

async function writeStore(store: Store): Promise<void> {
  await setJSON(DIRECTORY_KEY, store);
  memo = store;
}

export class RosterError extends Error {}

// ---------------------------------------------------------------------------
// Read accessors
// ---------------------------------------------------------------------------

export async function getAllTeams(): Promise<DashboardTeam[]> {
  return (await readStore()).teams;
}

export async function getActiveTeams(): Promise<DashboardTeam[]> {
  return (await getAllTeams()).filter((t) => t.status === "active");
}

export async function getTeamById(teamId: string): Promise<DashboardTeam | null> {
  return (await getAllTeams()).find((t) => t.teamId === teamId) ?? null;
}

export async function getAllMembers(): Promise<DashboardMember[]> {
  return (await readStore()).members;
}

export async function getActiveMembers(): Promise<DashboardMember[]> {
  return (await getAllMembers()).filter((m) => m.status === "active");
}

export async function getDeactivatedMembers(): Promise<DashboardMember[]> {
  return (await getAllMembers()).filter((m) => m.status === "deactivated");
}

export async function getMembersByTeam(teamId: string, opts: { includeInactive?: boolean } = {}): Promise<DashboardMember[]> {
  const members = opts.includeInactive ? await getAllMembers() : await getActiveMembers();
  return members.filter((m) => m.teamId === teamId);
}

export async function getMembersByRole(role: string): Promise<DashboardMember[]> {
  return (await getActiveMembers()).filter((m) => m.role === role);
}

export async function getMemberById(memberId: string): Promise<DashboardMember | null> {
  return (await getAllMembers()).find((m) => m.memberId === memberId) ?? null;
}

export async function getDashboardMemberByHubSpotOwnerId(ownerId: number): Promise<DashboardMember | null> {
  return (await getAllMembers()).find((m) => ownerIdsOf(m).includes(ownerId)) ?? null;
}

// ---------------------------------------------------------------------------
// Backward-compatible adapters — src/lib/aggregate.ts, /api/accounts,
// /api/company/[id], Data Assignment, and Data Reports all consume these
// exact functions/shapes unchanged from before this rewrite. They only ever
// reflect ACTIVE members on an ACTIVE team, which is what makes a
// deactivated member (or an archived team) disappear from every one of
// those places automatically, with no per-feature changes needed.
// ---------------------------------------------------------------------------

export type Assignment = {
  ownerIds: number[];
  name: string;
  role: Role | "Not Configured";
  /** Team NAME (not teamId) — named "pod" for historical/compatibility reasons; see aggregate.ts. */
  pod: string;
  source: "seed" | "manual";
  note?: string;
};

function toAssignment(m: DashboardMember, teamNameById: Map<string, string>): Assignment {
  return {
    ownerIds: ownerIdsOf(m),
    name: m.name,
    role: m.role,
    pod: teamNameById.get(m.teamId) ?? m.teamId,
    source: "manual",
    note: m.note,
  };
}

export async function getAssignments(): Promise<Assignment[]> {
  const [members, teams] = await Promise.all([getActiveMembers(), getActiveTeams()]);
  const teamNameById = new Map(teams.map((t) => [t.teamId, t.teamName]));
  return members.filter((m) => teamNameById.has(m.teamId)).map((m) => toAssignment(m, teamNameById));
}

export async function getPods(): Promise<string[]> {
  return (await getActiveTeams()).map((t) => t.teamName);
}

export async function getOwnerToAssignment(): Promise<Map<number, Assignment>> {
  const assignments = await getAssignments();
  return new Map(assignments.flatMap((a) => a.ownerIds.map((id) => [id, a] as const)));
}

export async function getAssignedOwnerIds(): Promise<Set<number>> {
  return new Set((await getOwnerToAssignment()).keys());
}

export async function getMergedAssignments(): Promise<Assignment[]> {
  return (await getAssignments()).filter((a) => a.ownerIds.length > 1);
}

// ---------------------------------------------------------------------------
// Admin mutations. None of these ever call a HubSpot write endpoint — they
// only change this store. Deactivating/removing a member is purely
// dashboardMember.status = "deactivated" | "removed"; the underlying
// HubSpot owner, their historical ownership, and their HubSpot record are
// completely untouched.
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `id-${Date.now()}`;
}

function uniqueId(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function addTeam(input: { teamName: string; managerId?: string | null }): Promise<DashboardTeam> {
  const store = await readStore();
  const name = input.teamName.trim();
  if (!name) throw new RosterError("Team name cannot be empty.");
  if (store.teams.some((t) => t.teamName.toLowerCase() === name.toLowerCase())) {
    throw new RosterError(`A team named "${name}" already exists.`);
  }
  const now = new Date().toISOString();
  const team: DashboardTeam = {
    teamId: uniqueId(slugify(name), new Set(store.teams.map((t) => t.teamId))),
    teamName: name,
    status: "active",
    managerId: input.managerId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.teams = [...store.teams, team];
  await writeStore(store);
  return team;
}

export async function updateTeam(teamId: string, patch: { teamName?: string; managerId?: string | null }): Promise<DashboardTeam> {
  const store = await readStore();
  const idx = store.teams.findIndex((t) => t.teamId === teamId);
  if (idx < 0) throw new RosterError("Team not found.");
  let teamName = store.teams[idx].teamName;
  if (patch.teamName !== undefined) {
    teamName = patch.teamName.trim();
    if (!teamName) throw new RosterError("Team name cannot be empty.");
    if (store.teams.some((t, i) => i !== idx && t.teamName.toLowerCase() === teamName.toLowerCase())) {
      throw new RosterError(`A team named "${teamName}" already exists.`);
    }
  }
  const updated: DashboardTeam = {
    ...store.teams[idx],
    teamName,
    managerId: patch.managerId !== undefined ? patch.managerId : store.teams[idx].managerId,
    updatedAt: new Date().toISOString(),
  };
  store.teams = [...store.teams.slice(0, idx), updated, ...store.teams.slice(idx + 1)];
  await writeStore(store);
  return updated;
}

/** Refuses to archive a team with active members unless `force` — matches the "never silently orphan members" requirement. */
export async function archiveTeam(teamId: string, opts: { force?: boolean } = {}): Promise<{ team: DashboardTeam; activeMemberCount: number }> {
  const store = await readStore();
  const idx = store.teams.findIndex((t) => t.teamId === teamId);
  if (idx < 0) throw new RosterError("Team not found.");
  const activeMemberCount = store.members.filter((m) => m.teamId === teamId && m.status === "active").length;
  if (activeMemberCount > 0 && !opts.force) {
    throw new RosterError(
      `This team has ${activeMemberCount} active member${activeMemberCount === 1 ? "" : "s"}. Move them to another team, or archive anyway.`
    );
  }
  const updated: DashboardTeam = { ...store.teams[idx], status: "archived", updatedAt: new Date().toISOString() };
  store.teams = [...store.teams.slice(0, idx), updated, ...store.teams.slice(idx + 1)];
  await writeStore(store);
  return { team: updated, activeMemberCount };
}

export async function reactivateTeam(teamId: string): Promise<DashboardTeam> {
  const store = await readStore();
  const idx = store.teams.findIndex((t) => t.teamId === teamId);
  if (idx < 0) throw new RosterError("Team not found.");
  const updated: DashboardTeam = { ...store.teams[idx], status: "active", updatedAt: new Date().toISOString() };
  store.teams = [...store.teams.slice(0, idx), updated, ...store.teams.slice(idx + 1)];
  await writeStore(store);
  return updated;
}

export async function moveAllMembers(fromTeamId: string, toTeamId: string): Promise<number> {
  const store = await readStore();
  if (!store.teams.some((t) => t.teamId === toTeamId)) throw new RosterError("Target team not found.");
  const now = new Date().toISOString();
  let count = 0;
  store.members = store.members.map((m) => {
    if (m.teamId === fromTeamId && m.status === "active") {
      count++;
      return { ...m, teamId: toTeamId, updatedAt: now };
    }
    return m;
  });
  await writeStore(store);
  return count;
}

export async function addMember(input: {
  name: string;
  email?: string | null;
  hubspotOwnerId: number;
  teamId: string;
  role: string;
}): Promise<DashboardMember> {
  const store = await readStore();
  const name = input.name.trim();
  if (!name) throw new RosterError("Name cannot be empty.");
  if (!isValidRole(input.role)) throw new RosterError("Role must be Manager, SDR, or AE.");
  if (!store.teams.some((t) => t.teamId === input.teamId)) throw new RosterError("Team not found.");
  const alreadyMapped = store.members.some(
    (m) => m.status !== "removed" && ownerIdsOf(m).includes(input.hubspotOwnerId)
  );
  if (alreadyMapped) throw new RosterError("This HubSpot owner is already on the dashboard.");

  const now = new Date().toISOString();
  const member: DashboardMember = {
    memberId: uniqueId(slugify(name), new Set(store.members.map((m) => m.memberId))),
    name,
    email: input.email ?? null,
    hubspotOwnerId: input.hubspotOwnerId,
    teamId: input.teamId,
    role: input.role,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  store.members = [...store.members, member];
  await writeStore(store);
  return member;
}

async function patchMember(memberId: string, patch: Partial<DashboardMember>): Promise<DashboardMember> {
  const store = await readStore();
  const idx = store.members.findIndex((m) => m.memberId === memberId);
  if (idx < 0) throw new RosterError("Member not found.");
  const updated: DashboardMember = { ...store.members[idx], ...patch, updatedAt: new Date().toISOString() };
  store.members = [...store.members.slice(0, idx), updated, ...store.members.slice(idx + 1)];
  await writeStore(store);
  return updated;
}

export async function updateMember(memberId: string, patch: { name?: string; email?: string | null }): Promise<DashboardMember> {
  return patchMember(memberId, patch);
}

export async function moveMember(memberId: string, newTeamId: string): Promise<DashboardMember> {
  const teams = await getAllTeams();
  if (!teams.some((t) => t.teamId === newTeamId)) throw new RosterError("Target team not found.");
  return patchMember(memberId, { teamId: newTeamId });
}

export async function updateMemberRole(memberId: string, role: string): Promise<DashboardMember> {
  if (!isValidRole(role)) throw new RosterError("Role must be Manager, SDR, or AE.");
  return patchMember(memberId, { role });
}

export async function deactivateMember(memberId: string, deactivatedBy: string): Promise<DashboardMember> {
  return patchMember(memberId, { status: "deactivated", deactivatedAt: new Date().toISOString(), deactivatedBy });
}

export async function reactivateMember(memberId: string): Promise<DashboardMember> {
  return patchMember(memberId, { status: "active", deactivatedAt: undefined, deactivatedBy: undefined });
}

/** Soft-archive only — never deletes the record, so historical references (past previews/exports) still resolve. */
export async function removeMember(memberId: string, removedBy: string): Promise<DashboardMember> {
  return patchMember(memberId, { status: "removed", removedAt: new Date().toISOString(), removedBy });
}
