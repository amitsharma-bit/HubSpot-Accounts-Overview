import assert from "node:assert/strict";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // no .env.local yet — offline checks below still run; live checks will fail with a clear error
}

import { GROUP_FLAG_TRUE, normalizeGroupFlag, buildFilterGroups, COUNTRY_FILTER } from "../src/lib/filters";
import { countCompanies } from "../src/lib/hubspot";

async function checkCountryFilterConstant() {
  const [combined, us, usa, usShort] = await Promise.all([
    countCompanies([{ filters: [COUNTRY_FILTER] }]),
    countCompanies([{ filters: [{ propertyName: "country", operator: "EQ", value: "United States" }] }]),
    countCompanies([{ filters: [{ propertyName: "country", operator: "EQ", value: "USA" }] }]),
    countCompanies([{ filters: [{ propertyName: "country", operator: "EQ", value: "US" }] }]),
  ]);
  assert.ok(us > 0 && usa > 0 && usShort > 0, "each US country-value variant should have at least one company");
  assert.equal(combined, us + usa + usShort, "IN-filter total must equal the sum of the individual EQ counts");
  console.log(`[PASS] country filter constant: ${combined} = ${us} + ${usa} + ${usShort}`);
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

function checkFilterGroupInvariants() {
  const cases = [
    { ownerIds: [1, 2, 3], city: "Dallas", state: "Texas", typeOfDealership: "Franchise", searchTerm: "auto", searchMatchedOwnerIds: [4, 5] },
    { unownedOnly: true },
    {},
  ];
  for (const c of cases) {
    const groups = buildFilterGroups(c);
    assert.ok(groups.length <= 5, "at most 5 filterGroups (HubSpot cap)");
    for (const g of groups) {
      assert.ok(g.filters.length <= 6, "at most 6 filters per group (HubSpot cap)");
      assert.ok(
        g.filters.some((f) => f.propertyName === "country"),
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
    report.dealershipTypeReconciliation.pass,
    true,
    `franchise+independent != total: ${JSON.stringify(report.dealershipTypeReconciliation)}`
  );
  console.log("[PASS] live /api/validate reconciliation");
}

async function main() {
  checkGroupFlagNormalization();
  checkFilterGroupInvariants();
  await checkCountryFilterConstant();
  await checkLiveValidation();
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("[FAIL]", err.message);
  process.exit(1);
});
