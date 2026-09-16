"use client";

import { useLayoutEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { FilterPanel } from "./FilterPanel";
import { useJson } from "@/lib/useJson";

const COLLAPSE_KEY = "hs-dashboard-sidebar-collapsed";
const EXPANDED_WIDTH = "264px";
const COLLAPSED_WIDTH = "72px";

const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function NavLink({ href, label, icon }: { href: string; label: string; icon: "grid" | "shield" | "columns" | "report" }) {
  const pathname = usePathname();
  return (
    <Link href={href} className={`nav-link${pathname === href ? " active" : ""}`} title={label}>
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}

function CrmStatusCard() {
  const { data, loading, error } = useJson<{ computedAt: string }>("/api/status");
  const date = data ? new Date(data.computedAt) : null;
  const synced = date && !Number.isNaN(date.getTime());

  return (
    <div className="crm-card">
      <span className="crm-dot" />
      <div>
        <div className="crm-title">HubSpot CRM</div>
        <div className="crm-status">{loading ? "Checking…" : error ? "Unavailable" : "Connected"}</div>
        {synced && <div className="crm-sync">Last sync: {IST_FORMATTER.format(date)} IST</div>}
      </div>
    </div>
  );
}

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  // .content's margin-left reads --sidebar-width — kept in sync here (a
  // layout effect, so it lands before paint and doesn't flash) rather than
  // prop-drilling collapsed state into a separate layout wrapper, since
  // Sidebar and .content are independent siblings in layout.tsx.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  }, [collapsed]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-top-row">
        <div className="brand">
          <span className="brand-mark">HS</span>
          {!collapsed && (
            <span className="brand-text">
              US Accounts
              <span>Overview</span>
            </span>
          )}
        </div>
        <button className="collapse-btn" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={13} />
        </button>
      </div>

      <nav className="sidenav">
        <NavLink href="/" label="Overview" icon="grid" />
        {!collapsed && (
          <Suspense fallback={null}>
            <FilterPanel />
          </Suspense>
        )}
        <NavLink href="/data-assignment" label="Data Assignment" icon="columns" />
        <NavLink href="/data-reports" label="Data Reports" icon="report" />
        <NavLink href="/control-center" label="Control Center" icon="shield" />
      </nav>

      <div className="sidebar-footer">{!collapsed && <CrmStatusCard />}</div>
    </aside>
  );
}
