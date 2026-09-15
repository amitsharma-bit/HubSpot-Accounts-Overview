/**
 * Business-logic smoke checks for Data Reports (isolated from
 * scripts/check-assignment.ts on purpose — the two features don't share
 * code). Run against REAL HubSpot data, bypassing the Redis-backed
 * owner/team lookup (same reason as check-assignment.ts: verifies the real
 * HubSpot query/mapping/CSV logic independent of local Redis reachability).
 *
 * Run: npx tsx scripts/check-data-reports.ts
 */
import assert from "node:assert";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // no .env.local yet — will fail below with a clear HubSpot auth error instead
}

import { searchCompanies } from "../src/lib/hubspot";
import { buildReportFilterGroups, formatReportDate } from "../src/lib/dataReports/companyService";
import { resolveAssociations } from "../src/lib/dataReports/associations";
import { csvHeaderLine, csvRowLine } from "../src/lib/dataReports/csv";
import { COMPANY_REPORT_COLUMNS, findColumnDef, DEFAULT_COLUMNS } from "../src/lib/dataReports/companyProperties";
import type { ReportDefinition, ReportRow } from "../src/lib/dataReports/types";

async function main() {
  // Every one of the 36 required columns (Phase 14) must be registered.
  assert.strictEqual(COMPANY_REPORT_COLUMNS.length, 36, `expected 36 registered columns, got ${COMPANY_REPORT_COLUMNS.length}`);
  const associationColumns = COMPANY_REPORT_COLUMNS.filter((c) => c.kind === "association");
  assert.strictEqual(associationColumns.length, 5, "expected exactly 5 association-derived columns");
  for (const c of COMPANY_REPORT_COLUMNS) {
    if (c.kind === "property") assert(c.internalName, `TEST FAILED: property column "${c.label}" has no internalName`);
    else assert.strictEqual(c.internalName, null, `TEST FAILED: association column "${c.label}" should not have a guessed internalName`);
  }
  console.log("TEST registry: 36 columns present, 5 correctly marked association-derived (no guessed internal names)");

  // Filter translation: an owner-only definition produces a real, valid HubSpot filter.
  const def: ReportDefinition = {
    owners: { ownerIds: [], includeUnassigned: true },
    columns: DEFAULT_COLUMNS,
    filters: [{ id: "1", columnKey: "Country Dropdown", operator: "is", value: "United States" }],
  };
  const groups = buildReportFilterGroups(def);
  assert.strictEqual(groups.length, 1, "TEST FAILED: expected a single AND filter group");
  assert(groups[0].filters.some((f) => f.propertyName === "hubspot_owner_id" && f.operator === "NOT_HAS_PROPERTY"), "TEST FAILED: unassigned-owner filter missing");
  assert(groups[0].filters.some((f) => f.propertyName === "country_dropdown" && f.operator === "EQ" && f.value === "United States"), "TEST FAILED: country filter not translated correctly");
  console.log("TEST filter translation: owner + property filter both translated to real HubSpot filters");

  // Real live search using the translated filters — must return real data, not an error.
  const propertyNames = DEFAULT_COLUMNS.map((l) => findColumnDef(l)?.internalName).filter((n): n is string => !!n);
  const page = await searchCompanies(groups, 1, ["hs_object_id", "hubspot_owner_id", ...propertyNames], { pageSize: 5 });
  assert(page.total >= 0, "TEST FAILED: search did not return a total");
  console.log(`TEST live search: ${page.total.toLocaleString()} real unassigned US companies, fetched ${page.results.length} sample rows`);
  if (page.results.length > 0) {
    console.log("  sample:", JSON.stringify(page.results[0].properties));
  }

  // Association resolution — real deal/contact/group associations for a few real company IDs.
  const search2 = await searchCompanies([{ filters: [{ propertyName: "num_associated_deals", operator: "GT", value: "0" }] }], 1, ["hs_object_id"], { pageSize: 3 });
  if (search2.results.length > 0) {
    const ids = search2.results.map((r) => r.id);
    const bundle = await resolveAssociations(ids, { deal: true, contact: false, group: false });
    for (const id of ids) {
      const dealIds = bundle.dealIds.get(id) ?? [];
      assert(dealIds.length > 0, `TEST FAILED: company ${id} has num_associated_deals > 0 but no resolved deal association`);
    }
    console.log(`TEST associations: resolved real deal associations for ${ids.length} real companies known to have associated deals`);
  } else {
    console.log("TEST associations: skipped (no real company with num_associated_deals > 0 found in this quick sample)");
  }

  // CSV generation: column order must exactly follow the selected order (Phase 13), never re-sorted.
  const rows: ReportRow[] = [
    { "Company name": "Zeta Motors", "Record ID": "999" },
    { "Company name": "Alpha Motors", "Record ID": "111" },
  ];
  const columns = ["Record ID", "Company name"];
  const header = csvHeaderLine(columns);
  assert.strictEqual(header, "Record ID,Company name", "TEST FAILED: CSV header does not follow selected column order");
  const line = csvRowLine(columns, rows[0]);
  assert.strictEqual(line, "999,Zeta Motors", "TEST FAILED: CSV row does not follow selected column order");
  // CSV escaping: a value containing a comma must be quoted.
  const escaped = csvRowLine(["Company name"], { "Company name": "Acme, Inc." });
  assert.strictEqual(escaped, '"Acme, Inc."', "TEST FAILED: comma-containing value was not CSV-escaped");
  console.log("TEST CSV: column order preserved exactly, comma-containing values escaped correctly");

  // Owner assigned date / Last Activity Date / Rooftop Last Activity display
  // as DD-Month-Year, not HubSpot's raw ISO timestamp.
  assert.strictEqual(formatReportDate("2026-07-14T18:51:08.344Z"), "14-July-2026", "TEST FAILED: date not formatted as DD-Month-Year");
  assert.strictEqual(formatReportDate(null), null, "TEST FAILED: a missing date should stay null, not become a formatted garbage string");
  assert.strictEqual(formatReportDate(""), null, "TEST FAILED: an empty-string date (HubSpot's 'not set' value) should stay null");
  console.log("TEST date formatting: DD-Month-Year applied correctly, missing/empty dates stay null");

  console.log("\nAll Data Reports smoke checks passed against real HubSpot data.");
}

main().catch((err) => {
  console.error("CHECK FAILED:", err);
  process.exit(1);
});
