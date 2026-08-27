/**
 * Static, code-level concepts that are NOT user-editable roster data.
 *
 * The actual owner -> role/pod assignments live in data/roster.json, managed
 * through src/lib/rosterStore.ts and editable from the Control Center page.
 * This file only holds the Role enum (a fixed set of job titles the app
 * understands) and the system-owner bucket list (bulk-import/holding owners
 * that are never real reps, however they're assigned).
 */

export type Role = "SDR" | "AE" | "SDR TL" | "Manager" | "Team Lead" | "AM" | "Other";

export const ROLE_ORDER: Role[] = ["SDR", "AE", "SDR TL", "Manager", "Team Lead", "AM", "Other"];

/** The default/no-pod sentinel value, always present in the pods list. */
export const UNASSIGNED_POD = "Unassigned";

/**
 * Non-human bulk-import / holding-bucket owners. These own real US accounts but
 * are never reps — they get their own labeled bucket in the UI, kept separate
 * from both pod totals and the genuine "Unmapped Owner" list. See
 * src/lib/aggregate.ts and the Control Center page.
 */
export const SYSTEM_OWNERS: Record<number, string> = {
  163826942: "salesops . (bulk import / holding bucket)",
};
