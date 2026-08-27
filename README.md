# HubSpot US Accounts Overview

Internal dashboard answering: how many US accounts does each rep own, which
pod/team they're on, how are accounts distributed by role, and which accounts
belong to whom — computed server-side from HubSpot, never from rows loaded in
the browser. See CLAUDE.md for the full data-correctness rationale (real
HubSpot properties verified live, not assumed).

## Setup

1. Copy `.env.example` to `.env.local` and fill in `HUBSPOT_TOKEN` (a HubSpot
   private-app token with scopes `crm.objects.companies.read` and
   `crm.objects.owners.read`).
2. Provision Redis and fill in `REDIS_URL` — see "Deploying to Vercel" below.
   Required even for local dev: the roster and the owner-count snapshot both
   live in Redis, not on disk (see why below).
3. `npm install`
4. `npm run dev` and open http://localhost:3000

The first load of the Teams/Members sections computes a per-owner count
across every HubSpot owner (~380 count-only API calls) and takes roughly a
minute cold. It's cached in-memory for 30 minutes and snapshotted to Redis,
refreshed hourly in production (see below) — locally it stays warm until the
snapshot ages out.

## Deploying to Vercel

This app was originally built assuming a single long-running local process
with a writable disk — Vercel serverless functions have neither (filesystem
is read-only outside `/tmp`, which itself isn't guaranteed to persist between
invocations; `fs.writeFile` throws `EROFS`). Two things had to change to
deploy there:

1. **Persistent storage moved to Redis.** Any standard Redis instance works —
   this deployment uses Redis Cloud (redis.io), connected via a plain
   `redis://user:pass@host:port` connection string over `ioredis` (not the
   Vercel Marketplace/Upstash REST integration, which speaks a different,
   HTTP-based protocol — a `redis://` URL won't work with that client, and
   vice versa). Add `REDIS_URL` as a Vercel project environment variable, and
   put the same value in `.env.local` for local dev against the same store.
2. **Hourly refresh runs outside Vercel.** Vercel Cron only allows a *daily*
   schedule on the Hobby plan (hourly needs Pro). Instead,
   `.github/workflows/hourly-refresh.yml` — a free GitHub Actions cron — pings
   `POST /api/refresh` every hour, which forces a fresh owner-count sweep and
   overwrites the Redis snapshot. To enable it, add two **GitHub repo
   secrets** (Settings → Secrets and variables → Actions):
   - `APP_URL` — your deployed URL, e.g. `https://your-app.vercel.app`
   - `CRON_SECRET` — any random string (e.g. `openssl rand -hex 32`); also set
     the *same* value as a `CRON_SECRET` environment variable in the Vercel
     project (it's what `/api/refresh` checks the request against, so the
     endpoint can't be triggered by anyone else)

   You can trigger it manually from the Actions tab (`workflow_dispatch`)
   instead of waiting an hour, to confirm it's wired up correctly.

Every route touching the owner-count sweep (`teams`, `members`, `validate`,
`filters`, `refresh`, `status`) sets `export const maxDuration = 290` so a
cold sweep has room to finish instead of hitting Vercel's default 10-second
function timeout — the fix for "Teams fails to load in production but
Overview works," which happens because `overview` is the one route
deliberately built to *avoid* the slow sweep.

## Editing the team roster

`data/roster.json` ships with the app as the **one-time seed** for a
brand-new, empty Redis store — the actual live source of truth is Redis
(`src/lib/rosterStore.ts`), written to via the Control Center page's
"Add / Update assignment" form (`POST /api/roster`). Pods are open-ended:
assigning someone to a pod name that doesn't exist yet creates it. If you want
to change the *initial* roster before a fresh deploy's first read, edit
`data/roster.json` — once Redis has been seeded, further edits to that file
have no effect; use the Control Center instead.

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
