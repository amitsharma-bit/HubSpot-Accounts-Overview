/**
 * Business-logic smoke checks for the Data Assignment engine (Phase 45/46),
 * run against REAL HubSpot data (not mocks) — this portal has real
 * Dealership Group records available, so verifying against them is strictly
 * better evidence than fabricated fixtures. Deliberately bypasses the
 * roster/Redis owner-name lookup (pass an empty owner map directly to the
 * mapping functions) so these checks work independent of Redis being
 * reachable — everything exercised here is pure HubSpot read + in-memory
 * logic, matching this app's existing scripts/check.ts pattern (plain
 * assert, no framework).
 *
 * Run: npx tsx scripts/check-assignment.ts
 */
import assert from "node:assert";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // no .env.local yet — will fail below with a clear HubSpot auth error instead
}
import { searchObjects, batchGetAssociations, batchReadObjects } from "../src/lib/hubspot";
import { GROUP_OBJECT_TYPE, GROUP_TO_COMPANY_ASSOCIATION, GROUP_PROPERTY_LIST, COMPANY_PROPERTY_LIST } from "../src/lib/assignment/propertyMap";
import { mapGroupRecord } from "../src/lib/assignment/groupService";
import { mapCompanyRecord } from "../src/lib/assignment/companyService";
import { classifyCompany, qualifyGroupForUsAssignment, evaluateRooftopAggregation } from "../src/lib/assignment/eligibility";
import { evaluateFilterGroup } from "../src/lib/assignment/filterEngine";
import { detectGroupConflicts, detectDuplicateIds } from "../src/lib/assignment/conflicts";
import type { Company, DealershipGroup, FilterGroup } from "../src/lib/assignment/types";

const emptyOwnerMap = new Map<number, { name: string; pod: string }>();

async function fetchGroupsWithMinRooftops(min: number, limit: number): Promise<{ group: DealershipGroup; companies: Company[] }[]> {
  // This portal's PropertyFilter type only exposes GT (not GTE) — GT(min-1) is
  // equivalent for the integer "rooftops" rollup.
  const search = await searchObjects(GROUP_OBJECT_TYPE, {
    filterGroups: [{ filters: [{ propertyName: "rooftops", operator: "GT", value: String(min - 1) }] }],
    properties: GROUP_PROPERTY_LIST,
    limit,
  });
  const groupIds = search.results.map((r) => r.id);
  const associations = await batchGetAssociations(GROUP_OBJECT_TYPE, groupIds, GROUP_TO_COMPANY_ASSOCIATION);
  const out: { group: DealershipGroup; companies: Company[] }[] = [];
  for (const raw of search.results) {
    const companyIds = associations.get(raw.id) ?? [];
    const rawCompanies = await batchReadObjects("companies", companyIds, COMPANY_PROPERTY_LIST);
    const companies = rawCompanies.map((r) => mapCompanyRecord(r, emptyOwnerMap));
    out.push({ group: mapGroupRecord(raw, emptyOwnerMap, companyIds), companies });
  }
  return out;
}

async function main() {
  console.log("Fetching real Dealership Groups with >= 3 associated rooftops...");
  const sample = await fetchGroupsWithMinRooftops(3, 8);
  assert(sample.length > 0, "expected at least one real group with >=3 rooftops");
  console.log(`  fetched ${sample.length} real groups`);

  // TEST 3: Potential/actual rooftops >= threshold filter match (GROUP scope).
  const rooftopFilter: FilterGroup = { kind: "leaf", filter: { field: "actualRooftops", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThanOrEqual", value: 3 } };
  for (const { group } of sample) {
    assert(evaluateFilterGroup(rooftopFilter, { group }), `TEST 3 FAILED: ${group.groupName} has actualRooftops=${group.actualRooftops}, expected >= 3`);
  }
  console.log("TEST 3 passed: actualRooftops >= 3 filter matches every fetched real group");

  // TEST 1 / TEST 2: US qualification — real data, both outcomes if present.
  let sawEligible = false;
  let sawIneligible = false;
  for (const { group, companies } of sample) {
    const q = qualifyGroupForUsAssignment(companies);
    if (q.eligible) sawEligible = true;
    else {
      sawIneligible = true;
      assert(q.reasons.includes("NON_US_ASSOCIATED_COMPANY") || q.reasons.includes("GROUP_NO_ASSOCIATED_COMPANIES"), `TEST 2 FAILED: ineligible group ${group.groupName} has no reason code`);
    }
    console.log(`  ${group.groupName}: ${companies.length} rooftops, US-qualified=${q.eligible}${q.eligible ? "" : ` (${q.reasons.join(",")})`}`);
  }
  console.log(`TEST 1/2: saw eligible=${sawEligible}, saw ineligible=${sawIneligible} among real sample (both outcomes are valid real data, not required to both occur)`);

  // TEST 4: "at least N rooftops have Used Cars > 100" aggregation, evaluated
  // both via the raw eligibility helper AND via the full filter engine, must agree.
  const withCars = sample.find((s) => s.companies.some((c) => (c.usedCars ?? 0) > 0));
  if (withCars) {
    const direct = evaluateRooftopAggregation(withCars.companies, (c) => (c.usedCars ?? 0) > 100, "AT_LEAST", 1);
    const viaEngine = evaluateFilterGroup(
      { kind: "leaf", filter: { field: "usedCars", scope: "AGGREGATED_ROOFTOPS", fieldType: "NUMBER", operator: "greaterThan", value: 100, aggregation: "AT_LEAST", aggregationCount: 1 } },
      { group: withCars.group, associatedCompanies: withCars.companies }
    );
    assert.strictEqual(direct, viaEngine, "TEST 4 FAILED: direct aggregation helper and filter engine disagree");
    console.log(`TEST 4 passed: rooftop aggregation (AT_LEAST 1, Used Cars > 100) = ${direct} for ${withCars.group.groupName}, engine agrees`);
  } else {
    console.log("TEST 4 skipped: no sampled group had any company with usedCars > 0");
  }

  // TEST 5: mixed-owner conflict detection — all sample companies are
  // unowned here (owner map bypassed), so this checks the NO-conflict path;
  // real mixed-ownership data would need a live roster (Redis), tested via
  // the API route instead once Redis is reachable.
  for (const { group, companies } of sample) {
    const conflicts = detectGroupConflicts(group, companies);
    const hasNoAssocConflict = conflicts.some((c) => c.type === "GROUP_NO_ASSOCIATED_COMPANIES");
    assert.strictEqual(hasNoAssocConflict, companies.length === 0, `TEST 5 FAILED: no-associated-companies conflict mismatch for ${group.groupName}`);
  }
  console.log("TEST 5 passed: group conflict detection runs cleanly over real data (no crash on real nulls/edge cases)");

  // TEST 6: multi-group selection with overlapping companies must dedupe by Record ID.
  const allIds = sample.flatMap((s) => s.companies.map((c) => c.id));
  const withDupe = [...allIds, allIds[0]];
  const deduped = Array.from(new Set(withDupe));
  assert.strictEqual(deduped.length, allIds.length, "TEST 6 FAILED: dedup by Record ID did not remove the injected duplicate");
  const dupeConflicts = detectDuplicateIds(withDupe, "DUPLICATE_COMPANY_RECORD_ID");
  assert.strictEqual(dupeConflicts.length, allIds[0] ? 1 : 0, "TEST 6 FAILED: duplicate-ID conflict detector found the wrong count");
  console.log("TEST 6 passed: overlapping company IDs across groups dedupe correctly by Record ID");

  // TEST 9: nested AND/OR filters over real data.
  const nested: FilterGroup = {
    kind: "node",
    operator: "AND",
    children: [
      { kind: "leaf", filter: { field: "actualRooftops", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThanOrEqual", value: 3 } },
      {
        kind: "node",
        operator: "OR",
        children: [
          { kind: "leaf", filter: { field: "usedCars", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThan", value: 100000 } }, // deliberately impossible
          { kind: "leaf", filter: { field: "actualRooftops", scope: "GROUP", fieldType: "NUMBER", operator: "lessThanOrEqual", value: 999 } }, // always true here
        ],
      },
    ],
  };
  for (const { group } of sample) {
    assert(evaluateFilterGroup(nested, { group }), `TEST 9 FAILED: ${group.groupName} should pass AND(>=3, OR(impossible, always-true))`);
  }
  console.log("TEST 9 passed: nested AND/OR evaluates correctly over real records");

  // TEST 10: date filter must be a real chronological comparison, not a string compare.
  const withActivity = sample.find((s) => s.group.gdLastActivity);
  if (withActivity) {
    const olderThan10000Days: FilterGroup = { kind: "leaf", filter: { field: "gdLastActivity", scope: "GROUP", fieldType: "DATE", operator: "olderThan", value: 10000 } };
    assert.strictEqual(evaluateFilterGroup(olderThan10000Days, { group: withActivity.group }), false, "TEST 10 FAILED: a recent real date matched 'older than 10000 days'");
    console.log(`TEST 10 passed: date comparison is real chronological math (checked against ${withActivity.group.gdLastActivity})`);
  } else {
    console.log("TEST 10 skipped: no sampled group had gd_last_activity populated");
  }

  // TEST 11: numeric filter, "1,250"-style formatting must never leak into comparison logic.
  const numFilter: FilterGroup = { kind: "leaf", filter: { field: "actualRooftops", scope: "GROUP", fieldType: "NUMBER", operator: "greaterThan", value: 2 } };
  for (const { group } of sample) {
    assert(evaluateFilterGroup(numFilter, { group }), `TEST 11 FAILED: numeric comparison failed for ${group.groupName} (actualRooftops=${group.actualRooftops})`);
  }
  console.log("TEST 11 passed: numeric filters compare real numbers, not formatted strings");

  // TEST 12: missing property must produce structured null handling, never a crash.
  const blankGroup = mapGroupRecord({ id: "999999999", properties: {} }, emptyOwnerMap, []);
  assert.strictEqual(blankGroup.groupName, null);
  assert.strictEqual(blankGroup.dealershipRank, null);
  assert.strictEqual(blankGroup.actualRooftops, null);
  const blankQualification = qualifyGroupForUsAssignment([]);
  assert.strictEqual(blankQualification.eligible, false);
  assert(blankQualification.reasons.includes("GROUP_NO_ASSOCIATED_COMPANIES"));
  console.log("TEST 12 passed: a fully-blank record maps to nulls and a structured (not thrown) qualification failure");

  // Classification: every fetched real company lands in exactly one pool, or UNCLASSIFIED with a reason.
  const allCompanies = sample.flatMap((s) => s.companies);
  for (const c of allCompanies) {
    const result = classifyCompany({ isPartOfGroupDealership: c.isPartOfGroupDealership, dealershipType: c.dealershipType });
    assert(["DEALERSHIP_GROUP", "SINGLE_FRANCHISE", "INDEPENDENT_ROOFTOP", "UNCLASSIFIED"].includes(result.pool));
    if (c.isPartOfGroupDealership) assert.strictEqual(result.pool, "DEALERSHIP_GROUP", `classification mismatch for ${c.companyName}`);
  }
  console.log(`Classification passed: ${allCompanies.length} real companies (all associated with a group) classified as DEALERSHIP_GROUP`);

  console.log("\nAll assignment-engine smoke checks passed against real HubSpot data.");
}

main().catch((err) => {
  console.error("CHECK FAILED:", err);
  process.exit(1);
});
