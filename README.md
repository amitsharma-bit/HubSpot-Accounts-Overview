# HubSpot US Accounts Overview

Internal dashboard answering: how many US accounts does each rep own, which
team are they on, how are accounts distributed by role, and which accounts
belong to whom — computed server-side from HubSpot, never from rows loaded in
the browser. See `docs` in the approved plan for the full data-correctness
rationale (real HubSpot properties verified live, not assumed).

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

`src/config/roster.ts` is the single source of truth for who's on which team,
in what role, and which HubSpot owner ID(s) they map to. Add, rename, or move
a person by editing this file directly — nothing else in the app hardcodes
names, teams, or roles.

Any HubSpot owner who has US accounts but isn't in this file shows up on the
Control Center page as an "Unmapped Owner" — never silently dropped.

## Verifying correctness

`npm run check` runs a handful of `assert`-based smoke checks: the
country-filter constant against live data, the group-dealership flag
normalization truth table, `buildFilterGroups`'s HubSpot API cap invariants,
and (with `npm run dev` running in another terminal) the live reconciliation
identity behind every total on the dashboard. The full validation report is
also rendered on the Control Center page.
