"use client";

import { useState } from "react";
import { useJson } from "@/lib/useJson";
import { AssignmentForm } from "./AssignmentForm";
import { PodPanel } from "./PodPanel";
import { PeopleTable } from "./PeopleTable";
import { TableSkeleton } from "./Skeletons";
import type { Person } from "@/app/api/roster/people/route";
import type { Assignment } from "@/lib/rosterStore";

export function ControlCenterClient() {
  const [refetchKey, setRefetchKey] = useState(0);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const { data: roster, loading: rosterLoading } = useJson<{ assignments: Assignment[]; pods: string[] }>(
    `/api/roster?r=${refetchKey}`
  );
  const { data: peopleData, loading: peopleLoading } = useJson<{ people: Person[] }>(`/api/roster/people?r=${refetchKey}`);

  if (rosterLoading || peopleLoading || !roster || !peopleData) return <TableSkeleton />;

  return (
    <>
      <AssignmentForm
        people={peopleData.people}
        pods={roster.pods}
        editingPerson={editingPerson}
        onSaved={() => setRefetchKey((k) => k + 1)}
      />
      <PodPanel pods={roster.pods} assignments={roster.assignments} />
      <PeopleTable people={peopleData.people} onEdit={setEditingPerson} />
    </>
  );
}
