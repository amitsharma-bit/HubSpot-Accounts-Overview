const ROLE_COLORS: Record<string, string> = {
  SDR: "#0EA5E9",
  AE: "#8B5CF6",
  "SDR TL": "#F59E0B",
  Manager: "#EC4899",
  "Team Lead": "#4F46E5",
  AM: "#14B8A6",
  Other: "#6B7280",
};

export function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "#6B7280";
  return (
    <span className="badge" style={{ background: `${color}1a`, color }}>
      {role}
    </span>
  );
}

const CLASS_COLORS: Record<string, string> = {
  Independent: "#F59E0B",
  Franchise: "#10B981",
  Group: "#8B5CF6",
};

const CLASS_LABELS: Record<string, string> = {
  Independent: "Independent",
  Franchise: "Franchise",
  Group: "In Group Dealership",
};

export function DealershipClassBadge({ dealershipClass }: { dealershipClass: string | null }) {
  if (!dealershipClass) return <span className="muted">&mdash;</span>;
  const color = CLASS_COLORS[dealershipClass] ?? "#6B7280";
  return (
    <span className="badge" style={{ background: `${color}1a`, color }}>
      {CLASS_LABELS[dealershipClass] ?? dealershipClass}
    </span>
  );
}
