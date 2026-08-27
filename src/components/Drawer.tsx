"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // Esc closes the drawer — standard, low-cost affordance for any dismissible panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">{title}</div>
            {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">{title}</div>
      <div className="drawer-fields">{children}</div>
    </div>
  );
}

export function DrawerField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="drawer-field">
      <span className="drawer-field-label">{label}</span>
      <span className="drawer-field-value">{value}</span>
    </div>
  );
}
