"use client";

import { useEffect, useState } from "react";

export function useJson<T>(url: string | null): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset to a loading state as soon as `url` changes, during render (React's
  // "adjust state when a prop changes" pattern) rather than as a synchronous
  // setState call inside the effect below.
  const [requestedUrl, setRequestedUrl] = useState(url);
  if (url !== requestedUrl) {
    setRequestedUrl(url);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
