export const ROLE_COLORS: Record<string, string> = {
  SDR: "var(--accent)",
  AE: "var(--color-purple)",
  "SDR TL": "var(--color-orange)",
  Manager: "var(--color-teal)",
  "Team Lead": "var(--accent-light)",
  AM: "var(--color-ink)",
  Other: "var(--color-slate)",
};

export function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "var(--color-slate)";
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {role}
    </span>
  );
}

const CLASS_COLORS: Record<string, string> = {
  Independent: "var(--color-orange)",
  Franchise: "var(--accent-light)",
  Group: "var(--color-purple)",
};

const CLASS_LABELS: Record<string, string> = {
  Independent: "Independent",
  Franchise: "Franchise",
  Group: "In Group Dealership",
};

export function DealershipClassBadge({ dealershipClass }: { dealershipClass: string | null }) {
  if (!dealershipClass) return <span className="muted">&mdash;</span>;
  const color = CLASS_COLORS[dealershipClass] ?? "var(--color-slate)";
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {CLASS_LABELS[dealershipClass] ?? dealershipClass}
    </span>
  );
}
