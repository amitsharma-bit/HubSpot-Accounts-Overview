import { PageHeader } from "@/components/PageHeader";
import { ControlCenterClient } from "@/components/ControlCenterClient";
import { UnmappedTable } from "@/components/UnmappedTable";
import { ValidationReportView } from "@/components/ValidationReportView";

export default function ControlCenterPage() {
  return (
    <>
      <PageHeader
        title="Admin · Control Center"
        subtitle="Assign each person's pod and role here. Matched to a real synced HubSpot owner, so the owner ID is always correct — no more name-matching guesswork."
      />

      <ControlCenterClient />
      <UnmappedTable />
      <ValidationReportView />
    </>
  );
}
