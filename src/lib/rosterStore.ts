import { promises as fs } from "fs";
import path from "path";
import type { Role } from "@/config/roster";

export type Assignment = {
  ownerIds: number[];
  name: string;
  role: Role;
  pod: string;
  source: "seed" | "manual";
  note?: string;
};

type Store = { pods: string[]; assignments: Assignment[] };

const STORE_PATH = path.join(process.cwd(), "data", "roster.json");

let cache: Store | null = null;

async function readStore(): Promise<Store> {
  if (cache) return cache;
  const raw = await fs.readFile(STORE_PATH, "utf8");
  cache = JSON.parse(raw) as Store;
  return cache;
}

async function writeStore(store: Store): Promise<void> {
  cache = store;
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function getAssignments(): Promise<Assignment[]> {
  return (await readStore()).assignments;
}

export async function getPods(): Promise<string[]> {
  return (await readStore()).pods;
}

export async function getOwnerToAssignment(): Promise<Map<number, Assignment>> {
  const assignments = await getAssignments();
  return new Map(assignments.flatMap((a) => a.ownerIds.map((id) => [id, a] as const)));
}

export async function getAssignedOwnerIds(): Promise<Set<number>> {
  return new Set((await getOwnerToAssignment()).keys());
}

export async function getMergedAssignments(): Promise<Assignment[]> {
  return (await getAssignments()).filter((a) => a.ownerIds.length > 1);
}

/**
 * Adds or updates one person's role/pod. If they already have an assignment
 * (matched by ownerId, since a merged entry's ownerIds array may hold more
 * than one HubSpot record for the same human), that entry is updated in
 * place — preserving any additional merged ownerIds and the note — rather
 * than replacing it with a single-owner entry.
 */
export async function upsertAssignment(input: {
  ownerId: number;
  name: string;
  role: Role;
  pod: string;
}): Promise<Assignment> {
  const store = await readStore();
  const pod = input.pod.trim();
  if (!pod) throw new Error("Pod name cannot be empty.");

  if (!store.pods.includes(pod)) store.pods = [...store.pods, pod];

  const existingIndex = store.assignments.findIndex((a) => a.ownerIds.includes(input.ownerId));
  let updated: Assignment;
  if (existingIndex >= 0) {
    updated = { ...store.assignments[existingIndex], name: input.name, role: input.role, pod, source: "manual" };
    store.assignments = [
      ...store.assignments.slice(0, existingIndex),
      updated,
      ...store.assignments.slice(existingIndex + 1),
    ];
  } else {
    updated = { ownerIds: [input.ownerId], name: input.name, role: input.role, pod, source: "manual" };
    store.assignments = [...store.assignments, updated];
  }

  await writeStore(store);
  return updated;
}
