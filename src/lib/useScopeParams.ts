"use client";

import { useSearchParams } from "next/navigation";

/** The sidebar filter scope (country/state/city/dealershipClass), read from the URL. */
export function useScopeParams(): URLSearchParams {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  for (const key of ["country", "state", "city", "dealershipClass"]) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return params;
}
