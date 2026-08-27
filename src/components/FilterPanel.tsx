"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useJson } from "@/lib/useJson";

type FilterOptionsResponse = {
  countries: { value: string; count: number }[];
  states: { value: string; count: number }[];
  dealershipClasses: string[];
};

const DEALERSHIP_LABELS: Record<string, string> = {
  Independent: "Independent",
  Franchise: "Franchise",
  Group: "In Group Dealership",
};

export function FilterPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [country, setCountry] = useState(() => searchParams.get("country") ?? "United States");
  const [state, setState] = useState(() => searchParams.get("state") ?? "");
  const [city, setCity] = useState(() => searchParams.get("city") ?? "");
  const [dealershipClass, setDealershipClass] = useState(() => searchParams.get("dealershipClass") ?? "");

  const { data } = useJson<FilterOptionsResponse>(`/api/filters?country=${encodeURIComponent(country)}`);

  function apply() {
    const next = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
    set("country", country === "United States" ? "" : country); // default, keep URL clean
    set("state", state);
    set("city", city);
    set("dealershipClass", dealershipClass);
    router.push(`/?${next.toString()}`);
  }

  function reset() {
    setCountry("United States");
    setState("");
    setCity("");
    setDealershipClass("");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("country");
    next.delete("state");
    next.delete("city");
    next.delete("dealershipClass");
    router.push(`/?${next.toString()}`);
  }

  return (
    <div className="filter-panel">
      <div className="filter-panel-label">Filters</div>

      <label className="filter-field">
        <span>Country</span>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setState(""); // states are country-dependent, stale selection would silently mismatch
          }}
        >
          <option value="United States">United States</option>
          {(data?.countries ?? [])
            .filter((c) => c.value !== "United States")
            .map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count.toLocaleString()})
              </option>
            ))}
        </select>
      </label>

      <label className="filter-field">
        <span>State</span>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All States</option>
          {(data?.states ?? []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.value} ({s.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>City</span>
        <input placeholder="Search city…" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>

      <label className="filter-field">
        <span>Type of Dealership</span>
        <select value={dealershipClass} onChange={(e) => setDealershipClass(e.target.value)}>
          <option value="">All Types</option>
          {(data?.dealershipClasses ?? ["Independent", "Franchise", "Group"]).map((c) => (
            <option key={c} value={c}>
              {DEALERSHIP_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </label>

      <p className="filter-panel-note">
        County isn&apos;t available — HubSpot doesn&apos;t have a County property on Company records in this portal.
      </p>

      <div className="filter-panel-actions">
        <button className="btn btn-primary" onClick={apply}>
          Apply Filters
        </button>
        <button className="btn btn-secondary" onClick={reset}>
          Reset Filters
        </button>
      </div>
    </div>
  );
}
