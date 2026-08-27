# HubSpot US Accounts Overview

Internal dashboard answering: how many US accounts does each rep own, which
pod/team they're on, how are accounts distributed by role, and which accounts
belong to whom — computed server-side from HubSpot, never from rows loaded in
the browser. See CLAUDE.md for the full data-correctness rationale (real
HubSpot properties verified live, not assumed).

## Setup

1. Copy `.env.example` to `.env.local` and set `HUBSPOT_TOKEN` to a HubSpot
   private-app token with scopes `crm.objects.companies.read` and
   `crm.objects.owners.read`.
2. `npm install`
3. `npm run dev` and open http://localhost:3000

The first load of the Teams/Members sections computes a per-owner count
across every HubSpot owner (~300 count-only API calls) and takes roughly a
minute cold. It's cached in-memory for 30 minutes and snapshotted to
`.cache/owner-counts.json` for 24 hours, so subsequent dev restarts are
instant until the snapshot expires.

## Editing the team roster

`data/roster.json` is the single source of truth for who's on which pod, in
what role, and which HubSpot owner ID(s) they map to. It's a real, git-tracked
data file — edit it by hand, or use the Control Center page's "Add / Update
assignment" form, which writes to it through `POST /api/roster`
(`src/lib/rosterStore.ts` owns all reads/writes and an in-memory cache).
Pods are open-ended: assigning someone to a pod name that doesn't exist yet
creates it.

`src/config/roster.ts` only holds two things that are *not* user-editable
data: the fixed `Role` enum and `SYSTEM_OWNERS`, a short list of non-human
bulk-import/holding owners (e.g. `salesops .`) that always get their own
labeled bucket instead of counting as "unmapped."

Any HubSpot owner who has US accounts but isn't in `data/roster.json` shows
up in the Control Center's people table with role "—" and pod "Unassigned" —
never silently dropped.

## Verifying correctness

`npm run check` runs a handful of `assert`-based smoke checks: that
`country_dropdown='United States'` actually returns data, the
group-dealership flag normalization truth table, the dealership
classification truth table, `buildFilterGroups`'s HubSpot API cap
invariants, and (with `npm run dev` running in another terminal) the live
reconciliation identity behind every total on the dashboard. The full
validation report is also rendered on the Control Center page.
