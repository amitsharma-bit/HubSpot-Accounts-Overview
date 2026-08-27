/** Never render null/undefined/"Invalid Date" — a blank em dash reads as "not set", not broken. */
export function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const asNumber = Number(raw);
  const date = raw.trim() !== "" && !Number.isNaN(asNumber) ? new Date(asNumber) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
