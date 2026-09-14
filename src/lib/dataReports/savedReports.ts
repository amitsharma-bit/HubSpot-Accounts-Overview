import { redis } from "../redis";
import type { SavedReport, ReportDefinition } from "./types";

/**
 * Data Reports' own saved-report store — a new Redis key namespace
 * ("data-reports:*"), completely separate from Data Assignment's
 * "assignment:saved-views:v1" and from Overview/Control Center's roster/
 * owner-count keys. Nothing here is shared with any other tab's saved views.
 */
const SAVED_REPORTS_KEY = "data-reports:saved-reports:v1";
const RECENT_EXPORTS_KEY = "data-reports:recent-exports:v1";
const RECENT_EXPORTS_MAX = 50;

export async function listSavedReports(): Promise<SavedReport[]> {
  const raw = await redis.hgetall(SAVED_REPORTS_KEY);
  return Object.values(raw)
    .map((v) => JSON.parse(v) as SavedReport)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSavedReport(input: {
  id?: string;
  name: string;
  description: string;
  definition: ReportDefinition;
  createdBy: string;
}): Promise<SavedReport> {
  const now = new Date().toISOString();
  const existingRaw = input.id ? await redis.hget(SAVED_REPORTS_KEY, input.id) : null;
  const existing = existingRaw ? (JSON.parse(existingRaw) as SavedReport) : null;
  const report: SavedReport = {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    description: input.description,
    definition: input.definition,
    createdBy: existing?.createdBy ?? input.createdBy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await redis.hset(SAVED_REPORTS_KEY, report.id, JSON.stringify(report));
  return report;
}

export async function duplicateSavedReport(id: string, newName: string): Promise<SavedReport | null> {
  const raw = await redis.hget(SAVED_REPORTS_KEY, id);
  if (!raw) return null;
  const original = JSON.parse(raw) as SavedReport;
  return saveSavedReport({ name: newName, description: original.description, definition: original.definition, createdBy: original.createdBy });
}

export async function renameSavedReport(id: string, newName: string): Promise<SavedReport | null> {
  const raw = await redis.hget(SAVED_REPORTS_KEY, id);
  if (!raw) return null;
  const report = JSON.parse(raw) as SavedReport;
  report.name = newName;
  report.updatedAt = new Date().toISOString();
  await redis.hset(SAVED_REPORTS_KEY, id, JSON.stringify(report));
  return report;
}

export async function deleteSavedReport(id: string): Promise<void> {
  await redis.hdel(SAVED_REPORTS_KEY, id);
}

export async function recordExport(entry: { reportName: string; recordCount: number; columnCount: number; exportedBy: string }): Promise<void> {
  const record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry, exportedAt: new Date().toISOString() };
  await redis.lpush(RECENT_EXPORTS_KEY, JSON.stringify(record));
  await redis.ltrim(RECENT_EXPORTS_KEY, 0, RECENT_EXPORTS_MAX - 1);
}

export async function listRecentExports(limit = 10) {
  const raw = await redis.lrange(RECENT_EXPORTS_KEY, 0, limit - 1);
  return raw.map((v) => JSON.parse(v));
}
