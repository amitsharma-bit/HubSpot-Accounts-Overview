export function CardGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton" style={{ height: 14, width: "50%", marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 26, width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div style={{ padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 16, width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}
