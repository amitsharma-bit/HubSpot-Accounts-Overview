"use client";

import { useJson } from "@/lib/useJson";
import { TableSkeleton } from "./Skeletons";
import type { ValidationReport } from "@/lib/types";

function Row({ label, value, pass }: { label: string; value: string | number | boolean; pass?: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={pass === undefined ? undefined : { color: pass ? "#10B981" : "#EF4444", fontWeight: 700 }}>
        {String(value)}
      </td>
    </tr>
  );
}

export function ValidationReportView() {
  const { data, loading, error } = useJson<ValidationReport>("/api/validate");

  if (loading) return <TableSkeleton />;
  if (error || !data) return <div className="muted">Failed to load validation report: {error}</div>;

  return (
    <div className="section">
      <div className="section-title">Validation Report</div>
      <div className="table-card">
        <div className="table-scroll">
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
                pass={data.reconciliation.pass}
              />
              <Row
                label="Independent + Franchise + In Group Dealership = Total"
                value={
                  data.classificationReconciliation.pass
                    ? "PASS"
                    : `FAIL (${data.classificationReconciliation.independent} + ${data.classificationReconciliation.franchise} + ${data.classificationReconciliation.inGroupDealership} != ${data.classificationReconciliation.total})`
                }
                pass={data.classificationReconciliation.pass}
              />
              <Row label="Duplicate record IDs" value={`${data.duplicateRecordIds.count} — ${data.duplicateRecordIds.reason}`} />
              <Row label="Pagination completeness" value={data.paginationComplete.explanation} />
              <Row label="Totals computed server-side" value={data.totalsServerSide.explanation} />
              <Row label="Computed at" value={data.computedAt} />
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-title" style={{ fontSize: "0.9rem" }}>
        Team Totals
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <tbody>
              {data.teamTotals.map((t) => (
                <Row key={t.team} label={t.team} value={t.accountCount} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
