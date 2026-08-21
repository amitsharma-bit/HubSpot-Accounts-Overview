export function CardGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card muted">
          Loading…
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return <div className="muted">Loading…</div>;
}
