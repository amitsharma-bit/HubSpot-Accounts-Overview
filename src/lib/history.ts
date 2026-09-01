import { redis } from "./redis";
import { teamTotals, roleTotals } from "./aggregate";
import type { OwnerCountsResult, OverviewResponse } from "./types";

/**
 * One JSON document per calendar day (IST, matching the rest of the app's
 * displayed timestamps), keyed in a single Redis hash. Storing the full
 * per-owner counts map (not just the 5 headline KPI numbers) alongside the
 * overview totals means team/role/member history can all be derived later
 * via aggregate.ts against the CURRENT roster — cheap, since it's plain JS
 * over an already-small in-memory map, no extra HubSpot calls.
 *
 * ponytail: a Redis hash with one field per date, not a time-series DB —
 * this is a few hundred small JSON docs at most (capped at HISTORY_MAX_DAYS),
 * nowhere near needing real time-series infrastructure.
 */
const HISTORY_KEY = "history:daily:v1";
const HISTORY_MAX_DAYS = 400;

export type DailySnapshot = {
  date: string; // YYYY-MM-DD, IST
  computedAt: string;
  overview: OverviewResponse;
  ownerCounts: Record<number, number>;
};

function istDateKey(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly — the one built-in locale format that does.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

/**
 * Called once per day from the hourly refresh job (the job itself still runs
 * hourly for the live snapshot; this just skips writing a new history entry
 * if today's already recorded), so history accumulates once per day rather
 * than 24 near-duplicate entries.
 */
export async function recordDailySnapshotIfNeeded(overview: OverviewResponse, ownerCounts: OwnerCountsResult): Promise<void> {
  const date = istDateKey();
  const exists = await redis.hexists(HISTORY_KEY, date);
  if (exists) return;

  const snapshot: DailySnapshot = { date, computedAt: ownerCounts.computedAt, overview, ownerCounts: ownerCounts.counts };
  await redis.hset(HISTORY_KEY, date, JSON.stringify(snapshot));

  const allDates = await redis.hkeys(HISTORY_KEY);
  if (allDates.length > HISTORY_MAX_DAYS) {
    const toDrop = allDates.sort().slice(0, allDates.length - HISTORY_MAX_DAYS);
    if (toDrop.length > 0) await redis.hdel(HISTORY_KEY, ...toDrop);
  }
}

async function readAllSnapshots(): Promise<DailySnapshot[]> {
  const raw = await redis.hgetall(HISTORY_KEY);
  return Object.values(raw)
    .map((v) => JSON.parse(v) as DailySnapshot)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type OverviewHistoryPoint = {
  date: string;
  totalUsAccounts: number;
  independent: number;
  franchise: number;
  inGroupDealership: number;
  salesOpsAccounts: number;
};

/** Newest `days` calendar days of overview KPI history, oldest first. */
export async function getOverviewHistory(days: number): Promise<OverviewHistoryPoint[]> {
  const all = await readAllSnapshots();
  return all.slice(-days).map((s) => ({
    date: s.date,
    totalUsAccounts: s.overview.totalUsAccounts,
    independent: s.overview.independent,
    franchise: s.overview.franchise,
    inGroupDealership: s.overview.inGroupDealership,
    salesOpsAccounts: s.overview.salesOps.accounts,
  }));
}

export type TeamHistoryPoint = { date: string; accountCount: number };

/** A single team's account-count history, derived from stored per-owner snapshots + the CURRENT roster. */
export async function getTeamHistory(team: string, days: number): Promise<TeamHistoryPoint[]> {
  const all = await readAllSnapshots();
  const recent = all.slice(-days);
  const points = await Promise.all(
    recent.map(async (s) => {
      const totals = await teamTotals({ counts: s.ownerCounts, unowned: 0, total: 0, computedAt: s.computedAt });
      const match = totals.find((t) => t.team === team);
      return { date: s.date, accountCount: match?.accountCount ?? 0 };
    })
  );
  return points;
}

export type MemberHistoryPoint = { date: string; accountCount: number };

/** A single member's account-count history, keyed by their merged ownerIds — see getTeamHistory's caveat. */
export async function getMemberHistory(ownerIds: number[], days: number): Promise<MemberHistoryPoint[]> {
  const all = await readAllSnapshots();
  const recent = all.slice(-days);
  return recent.map((s) => ({
    date: s.date,
    accountCount: ownerIds.reduce((sum, id) => sum + (s.ownerCounts[id] ?? 0), 0),
  }));
}

export type RoleHistoryPoint = { date: string; totals: Record<string, number> };

export async function getRoleHistory(days: number): Promise<RoleHistoryPoint[]> {
  const all = await readAllSnapshots();
  const recent = all.slice(-days);
  return Promise.all(
    recent.map(async (s) => ({
      date: s.date,
      totals: await roleTotals({ counts: s.ownerCounts, unowned: 0, total: 0, computedAt: s.computedAt }),
    }))
  );
}
