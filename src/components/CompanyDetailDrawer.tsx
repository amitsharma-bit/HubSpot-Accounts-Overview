"use client";

import { useJson } from "@/lib/useJson";
import { fmt, fmtDate } from "@/lib/format";
import { Drawer, DrawerSection, DrawerField } from "./Drawer";
import { RoleBadge } from "./Badge";
import { Icon } from "./Icon";
import type { CompanyDetail } from "@/lib/types";

export function CompanyDetailDrawer({
  companyId,
  open,
  onClose,
  onOpenGroup,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onOpenGroup: (gdId: string) => void;
}) {
  const { data, loading, error } = useJson<CompanyDetail>(`/api/company/${companyId}`);

  return (
    <Drawer open={open} title={data?.name ?? "Company"} subtitle="Company details" onClose={onClose}>
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="muted">Failed to load company: {error}</div>}
      {data && (
        <>
          <DrawerSection title="Company Information">
            <DrawerField label="Company Name" value={fmt(data.name)} />
            <DrawerField label="Domain" value={fmt(data.domain)} />
            <DrawerField label="HubSpot Record ID" value={data.id} />
            <DrawerField label="Company Owner" value={fmt(data.ownerName)} />
            <DrawerField
              label="HubSpot Team"
              value={
                data.hubspotTeamId
                  ? `ID ${data.hubspotTeamId}`
                  : "—"
              }
            />
            <DrawerField label="Lifecycle Stage" value={fmt(data.lifecycleStage)} />
          </DrawerSection>

          <DrawerSection title="Dealership / Assignment Information">
            <DrawerField label="GD Level" value={fmt(data.gdLevel)} />
            <DrawerField label="Number of Used Cars" value={data.numberOfUsedCars ?? "—"} />
            <DrawerField label="Potential Rooftops" value={data.potentialRooftops ?? "—"} />
            <DrawerField
              label="Dealership Group Name"
              value={
                data.inGroupDealership && data.gdId ? (
                  <button className="link-button" onClick={() => onOpenGroup(data.gdId!)}>
                    {fmt(data.gdName)}
                  </button>
                ) : (
                  fmt(data.gdName)
                )
              }
            />
            <DrawerField label="Owner Assigned Date" value={fmtDate(data.ownerAssignedDate)} />
          </DrawerSection>

          <DrawerSection title="Contact Information">
            <DrawerField label="Associated Contacts" value={data.numAssociatedContacts ?? "—"} />
          </DrawerSection>

          <DrawerSection title="Activity Information">
            <DrawerField label="Last Activity Date" value={fmtDate(data.lastActivityDate)} />
          </DrawerSection>

          <DrawerSection title="Dashboard Assignment">
            <DrawerField label="Pod / Team" value={fmt(data.team)} />
            <DrawerField label="Role" value={data.role ? <RoleBadge role={data.role} /> : "—"} />
          </DrawerSection>

          {data.hubspotUrl && (
            <a className="btn btn-primary" href={data.hubspotUrl} target="_blank" rel="noopener noreferrer">
              Open in HubSpot <Icon name="externalLink" size={14} />
            </a>
          )}
        </>
      )}
    </Drawer>
  );
}
