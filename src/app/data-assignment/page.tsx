import { DataAssignmentClient } from "@/components/assignment/DataAssignmentClient";

export default function DataAssignmentPage() {
  return (
    <>
      <div className="page-header">
        <h1>Data Assignment</h1>
        <p>
          DRY-RUN prototype — computes exactly what would be assigned. No HubSpot records are ever modified from this
          page.
        </p>
      </div>
      <DataAssignmentClient />
    </>
  );
}
