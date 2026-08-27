import { promises as fs } from "fs";
import path from "path";
import { getJSON, setJSON } from "./redis";
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

// Redis is the real, durable store (required once deployed — Vercel functions
// can't write to their own filesystem). data/roster.json ships with the app
// only as the one-time seed for a brand-new, empty Redis store, so the
// carefully-built initial roster doesn't have to be re-entered by hand.
const ROSTER_KEY = "roster:v1";
const SEED_PATH = path.join(process.cwd(), "data", "roster.json");

let memo: Store | null = null;

async function readSeed(): Promise<Store> {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(raw) as Store;
}

async function readStore(): Promise<Store> {
  if (memo) return memo;
  const raw = await getJSON<Store>(ROSTER_KEY);
  if (raw) {
    memo = raw;
    return raw;
  }
  const seed = await readSeed();
  await setJSON(ROSTER_KEY, seed);
  memo = seed;
  return seed;
}

async function writeStore(store: Store): Promise<void> {
  await setJSON(ROSTER_KEY, store);
  memo = store;
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
