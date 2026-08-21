"use client";

import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { ValidationReport } from "@/lib/types";

function Row({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{String(value)}</td>
    </tr>
  );
}

export function ValidationReportView() {
  const { data, loading, error } = useJson<ValidationReport>("/api/validate");

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load validation report: {error}</div>;

  return (
    <div>
      <div className="section-title">Validation Report</div>
      <table>
        <tbody>
          <Row label="Total distinct US accounts" value={data.totalDistinctUsAccounts} />
          <Row label="HubSpot owners with US accounts" value={data.ownersWithUsAccounts} />
          <Row label="Unmapped owner count" value={data.unmappedOwnerCount} />
          <Row label="Unmapped account count" value={data.unmappedAccountCount} />
          <Row label="System bucket account count" value={data.systemBucketAccountCount} />
          <Row label="Accounts with no owner" value={data.unownedCount} />
          <Row
            label="Reconciliation (sum(owner counts) + unowned = total)"
            value={data.reconciliation.pass ? "PASS" : `FAIL (delta ${data.reconciliation.delta})`}
          />
          <Row
            label="Franchise + Independent = Total"
            value={
              data.dealershipTypeReconciliation.pass
                ? "PASS"
                : `FAIL (${data.dealershipTypeReconciliation.franchise} + ${data.dealershipTypeReconciliation.independent} != ${data.dealershipTypeReconciliation.total})`
            }
          />
          <Row label="Companies with no country set (logged, out of scope)" value={data.countryUnassignedTotal} />
          <Row label="Duplicate record IDs" value={`${data.duplicateRecordIds.count} — ${data.duplicateRecordIds.reason}`} />
          <Row label="Pagination completeness" value={data.paginationComplete.explanation} />
          <Row label="Totals computed server-side" value={data.totalsServerSide.explanation} />
          <Row label="Computed at" value={data.computedAt} />
        </tbody>
      </table>

      <div style={{ marginTop: "1rem" }}>
        <div className="section-title">Team Totals</div>
        <table>
          <tbody>
            {data.teamTotals.map((t) => (
              <Row key={t.team} label={t.team} value={t.accountCount} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
