import type { ReportRow } from "./types";

function escapeCsvCell(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvHeaderLine(columns: string[]): string {
  return columns.map(escapeCsvCell).join(",");
}

export function csvRowLine(columns: string[], row: ReportRow): string {
  return columns.map((c) => escapeCsvCell(row[c] ?? null)).join(",");
}

/** One CSV row per column-def order, exactly as selected (Phase 13) — never re-sorted. */
export function rowsToCsv(columns: string[], rows: ReportRow[]): string {
  const lines = rows.map((row) => csvRowLine(columns, row));
  return [csvHeaderLine(columns), ...lines].join("\r\n") + "\r\n";
}
