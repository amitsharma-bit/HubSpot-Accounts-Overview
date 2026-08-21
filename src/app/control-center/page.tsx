import { RosterTable } from "@/components/RosterTable";
import { UnmappedTable } from "@/components/UnmappedTable";
import { ValidationReportView } from "@/components/ValidationReportView";

export default function ControlCenterPage() {
  return (
    <div>
      <h1>Control Center</h1>
      <p className="muted">
        Owner &rarr; role &rarr; team mapping, unmapped owners, and the accuracy validation report. Add, rename, or
        move a team member by editing <code>src/config/roster.ts</code>.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <RosterTable />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <UnmappedTable />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <ValidationReportView />
      </section>
    </div>
  );
}
