"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// Exit-close duration must match .drawer-out/.overlay-out's animation-duration
// in globals.css — the drawer stays mounted for this long after `open` goes
// false so it can slide back out the way it came in, instead of vanishing.
const CLOSE_MS = 220;

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
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  // Derived synchronously during render (this codebase's established
  // pattern for "adjust state when a prop changes") rather than in an
  // effect — opening/starting-to-close are pure functions of `open`.
  if (open && !rendered) {
    setRendered(true);
    setClosing(false);
  }
  if (!open && rendered && !closing) {
    setClosing(true);
  }

  // The actual unmount has to wait for the exit animation (CLOSE_MS) to
  // finish — that's a real external timer, so it's the one part of this
  // that legitimately belongs in an effect. It only sets state inside the
  // timeout callback, never synchronously in the effect body.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing]);

  // Esc closes the drawer — standard, low-cost affordance for any dismissible panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div className={`drawer-overlay${closing ? " drawer-overlay-out" : ""}`} onClick={onClose}>
      <aside className={`drawer${closing ? " drawer-out" : ""}`} onClick={(e) => e.stopPropagation()}>
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
