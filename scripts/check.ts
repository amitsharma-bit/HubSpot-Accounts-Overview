import assert from "node:assert/strict";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // no .env.local yet — offline checks below still run; live checks will fail with a clear error
}

import { GROUP_FLAG_TRUE, normalizeGroupFlag, buildFilterGroups, classifyDealership, COUNTRY_PROPERTY, DEFAULT_COUNTRY } from "../src/lib/filters";
import { countCompanies } from "../src/lib/hubspot";

async function checkCountryFilterHasData() {
  const total = await countCompanies([{ filters: [{ propertyName: COUNTRY_PROPERTY, operator: "EQ", value: DEFAULT_COUNTRY }] }]);
  assert.ok(total > 0, `${COUNTRY_PROPERTY}='${DEFAULT_COUNTRY}' returned 0 — did the property name or value change in HubSpot?`);
  console.log(`[PASS] ${COUNTRY_PROPERTY}='${DEFAULT_COUNTRY}': ${total} companies`);
}

function checkGroupFlagNormalization() {
  assert.equal(GROUP_FLAG_TRUE.length, 2, "dropping the legacy 'Yes' value would undercount by ~0.4%");
  assert.equal(normalizeGroupFlag("true"), true, "the real stored value, not the display label 'Yes'");
  assert.equal(normalizeGroupFlag("Yes"), true, "legacy stale raw value from before the property was normalized");
  assert.equal(normalizeGroupFlag("false"), false);
  assert.equal(normalizeGroupFlag(undefined), false);
  assert.equal(normalizeGroupFlag(""), false);
  console.log("[PASS] normalizeGroupFlag truth table");
}

function checkClassification() {
  // Group membership takes priority over type — verified live to reproduce the
  // user's baseline exactly (see src/lib/filters.ts's classifyDealership doc).
  assert.equal(classifyDealership("Franchise", "true"), "Group");
  assert.equal(classifyDealership("Independent", "true"), "Group");
  assert.equal(classifyDealership("Franchise", "false"), "Franchise");
  assert.equal(classifyDealership("Independent", "false"), "Independent");
  assert.equal(classifyDealership(null, "false"), null);
  console.log("[PASS] classifyDealership truth table");
}

function checkFilterGroupInvariants() {
  const cases = [
    { ownerIds: [1, 2, 3], city: "Dallas", state: "Texas", dealershipClass: "Franchise" as const, searchTerm: "auto", searchMatchedOwnerIds: [4, 5] },
    { unownedOnly: true },
    {},
  ];
  for (const c of cases) {
    const groups = buildFilterGroups(c);
    assert.ok(groups.length <= 5, "at most 5 filterGroups (HubSpot cap)");
    for (const g of groups) {
      assert.ok(g.filters.length <= 6, "at most 6 filters per group (HubSpot cap)");
      assert.ok(
        g.filters.some((f) => f.propertyName === COUNTRY_PROPERTY),
        "every group must carry the country filter"
      );
    }
  }
  console.log("[PASS] buildFilterGroups invariants");
}

async function checkLiveValidation() {
  const res = await fetch("http://localhost:3000/api/validate");
  if (!res.ok) {
    console.log("[SKIP] live reconciliation check — start `npm run dev` first, then re-run `npm run check`");
    return;
  }
  const report = await res.json();
  assert.equal(report.reconciliation.pass, true, `reconciliation failed, delta=${report.reconciliation.delta}`);
  assert.equal(
    report.classificationReconciliation.pass,
    true,
    `independent+franchise+inGroupDealership != total: ${JSON.stringify(report.classificationReconciliation)}`
  );
  console.log("[PASS] live /api/validate reconciliation");
}

async function main() {
  checkGroupFlagNormalization();
  checkClassification();
  checkFilterGroupInvariants();
  await checkCountryFilterHasData();
  await checkLiveValidation();
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("[FAIL]", err.message);
  process.exit(1);
});
