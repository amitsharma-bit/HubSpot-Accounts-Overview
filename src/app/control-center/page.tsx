import { ControlCenterClient } from "@/components/ControlCenterClient";
import { UnmappedTable } from "@/components/UnmappedTable";
import { ValidationReportView } from "@/components/ValidationReportView";

export default function ControlCenterPage() {
  return (
    <>
      <div className="page-header">
        <h1>Admin &middot; Control Center</h1>
        <p>
          Assign each person&apos;s pod and role here. Matched to a real synced HubSpot owner, so the owner ID is
          always correct — no more name-matching guesswork.
        </p>
      </div>

      <ControlCenterClient />
      <UnmappedTable />
      <ValidationReportView />
    </>
  );
}
