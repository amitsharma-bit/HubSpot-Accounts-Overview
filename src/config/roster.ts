/**
 * Static, code-level concepts that are NOT user-editable roster data.
 *
 * The actual dashboard team/member directory lives in Redis
 * (src/lib/rosterStore.ts), seeded once from data/dashboardDirectory.json,
 * and is managed entirely from the Control Center — see rosterStore.ts's
 * doc comment for the HubSpot-users vs. dashboard-members architecture.
 */

/** The dashboard supports exactly these three roles — nothing else, by design. */
export type Role = "Manager" | "SDR" | "AE";

export const ROLE_ORDER: Role[] = ["Manager", "SDR", "AE"];

export function isValidRole(value: string): value is Role {
  return (ROLE_ORDER as string[]).includes(value);
}

/**
 * Non-human bulk-import / holding-bucket owners. These own real US accounts but
 * are never reps — they get their own labeled bucket in the UI, kept separate
 * from both team totals and the genuine "Unmapped Owner" list. See
 * src/lib/aggregate.ts and the Control Center page.
 */
export const SYSTEM_OWNERS: Record<number, string> = {
  163826942: "salesops . (bulk import / holding bucket)",
};
