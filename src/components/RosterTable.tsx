import { MERGED_MEMBERS, ROSTER } from "@/config/roster";

export function RosterTable() {
  return (
    <div>
      <div className="section-title">HubSpot Owner &rarr; Role &rarr; Team</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner ID(s)</th>
            <th>Role</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {ROSTER.map((m) => (
            <tr key={m.ownerIds.join(",")}>
              <td>{m.name}</td>
              <td>{m.ownerIds.join(", ")}</td>
              <td>{m.role}</td>
              <td>{m.team}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {MERGED_MEMBERS.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div className="section-title">Merged Owner IDs — Advisory</div>
          <p className="muted">
            These roster entries sum counts across more than one HubSpot owner ID, usually a legacy duplicate record
            from a name change. Verify the merge is correct.
          </p>
          <ul>
            {MERGED_MEMBERS.map((m) => (
              <li key={m.name}>
                <strong>{m.name}</strong> ({m.ownerIds.join(", ")}) — {m.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
