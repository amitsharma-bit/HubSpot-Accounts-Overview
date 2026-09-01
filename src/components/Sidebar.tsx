"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { FilterPanel } from "./FilterPanel";
import { useJson } from "@/lib/useJson";

const COLLAPSE_KEY = "hs-dashboard-sidebar-collapsed";

const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function NavLink({ href, label, icon }: { href: string; label: string; icon: "grid" | "shield" }) {
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
      <div className="brand">
        <span className="brand-mark">HS</span>
        {!collapsed && (
          <span className="brand-text">
            US Accounts
            <span>Overview</span>
          </span>
        )}
      </div>

      <nav className="sidenav">
        <NavLink href="/" label="Overview" icon="grid" />
        {!collapsed && (
          <Suspense fallback={null}>
            <FilterPanel />
          </Suspense>
        )}
        <NavLink href="/control-center" label="Control Center" icon="shield" />
      </nav>

      <div className="sidebar-footer">
        {!collapsed && <CrmStatusCard />}
        <button className="collapse-btn" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={14} />
        </button>
      </div>
    </aside>
  );
}
