import { Suspense } from "react";
import { OverviewClient } from "@/components/OverviewClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <OverviewClient />
    </Suspense>
  );
}
