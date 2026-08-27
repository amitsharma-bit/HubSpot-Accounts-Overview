"use client";

import { useJson } from "@/lib/useJson";

const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function LastRefreshed() {
  const { data, loading, error } = useJson<{ computedAt: string }>("/api/status");
  if (loading || error || !data) return null;

  const date = new Date(data.computedAt);
  if (Number.isNaN(date.getTime())) return null;

  return <div className="last-refreshed">Refreshed {IST_FORMATTER.format(date)} IST</div>;
}
