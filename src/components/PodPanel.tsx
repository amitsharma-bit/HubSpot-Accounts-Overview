"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./Badge";
import type { Assignment } from "@/lib/rosterStore";

export function PodPanel({ pods, assignments }: { pods: string[]; assignments: Assignment[] }) {
  const [selected, setSelected] = useState<string | null>(pods[0] ?? null);

  const countsByPod = pods.map((pod) => {
    const members = assignments.filter((a) => a.pod === pod);
    return {
      pod,
      members,
      ae: members.filter((m) => m.role === "AE").length,
      sdr: members.filter((m) => m.role === "SDR").length,
    };
  });

  const active = countsByPod.find((c) => c.pod === selected) ?? countsByPod[0];

  return (
    <div className="section">
      <div>
        <div className="section-title">Team members</div>
        <p className="muted">Click a pod to see its SDRs and AEs.</p>
      </div>

      <div className="filter-bar" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
        {countsByPod.map((c) => (
          <button
            key={c.pod}
            className={`pill${selected === c.pod ? " selected" : ""}`}
            onClick={() => setSelected(c.pod)}
            style={{ flex: "none" }}
          >
            {c.pod} <span className="count">· {c.ae} AE / {c.sdr} SDR</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="card">
          <div className="section-title" style={{ fontSize: "0.95rem" }}>
            {active.pod} — {active.ae} AE, {active.sdr} SDR
          </div>
          {active.members.length === 0 ? (
            <p className="muted" style={{ marginTop: "0.5rem" }}>No one is assigned to this pod yet.</p>
          ) : (
            <div className="card-grid" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {active.members.map((m) => (
                <div key={m.ownerIds.join(",")} className="person" style={{ padding: "0.5rem 0.7rem", border: "1px solid var(--border)", borderRadius: "10px" }}>
                  <Avatar name={m.name} size={30} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "0.88rem" }}>{m.name}</span>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
