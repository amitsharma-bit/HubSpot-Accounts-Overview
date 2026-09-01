"use client";

import { useState } from "react";
import { Icon } from "./Icon";

const STORAGE_KEY = "hs-dashboard-theme";

export function ThemeToggle() {
  // The actual theme is set before first paint by the inline script in
  // layout.tsx (reading localStorage / prefers-color-scheme) — this just
  // mirrors that into React state via a lazy initializer (same pattern as
  // AccountsTable's loadColumnPrefs) so the toggle renders the right icon.
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark");

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence only
    }
    setDark(!dark);
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
      <span className="theme-toggle-thumb">
        <Icon name={dark ? "moon" : "sun"} size={12} />
      </span>
    </button>
  );
}
