# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

"HubSpot US Accounts Overview" — an internal Next.js dashboard, deployed on Vercel, that answers, with verified accuracy, how many US accounts (HubSpot Company records) each rep owns, which pod/team they're on, how accounts break down by role and by dealership classification, and which specific accounts belong to whom — all filterable live by Country/State/City/Dealership-type from a sidebar panel, refreshed hourly. It replaced a prior dashboard that computed totals from whatever rows happened to be loaded in the browser and got them wrong. **Correctness is the whole point of this codebase** — every number displayed comes from a server-side HubSpot count query or a verified reconciliation identity, never from summing/filtering client-loaded rows.

## Commands

```
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build (also the fastest full type-check)
npm run lint     # eslint .
npm run check    # scripts/check.ts — see "Verifying correctness" below
```

There is no test framework beyond `npm run check`. It runs `assert`-based smoke checks (offline truth-table/invariant checks plus two live checks against HubSpot) rather than a per-function test suite — see `scripts/check.ts`.

Setup: copy `.env.example` to `.env.local` and fill in `HUBSPOT_TOKEN`, `KV_REST_API_URL`/`KV_REST_API_TOKEN`, and `CRON_SECRET`. Full setup and Vercel deployment notes are in README.md.

## Architecture

### Three data sources

1. **HubSpot itself** (`src/lib/hubspot.ts`) — the real Companies Search API, Owners API, and Properties API, called with a private-app token. `countCompanies()` is how every aggregate number in the app is produced: a `limit:1` search read only for its `total` field, never by paging through and counting rows. `searchCompanies()`/`scanCompanies()` are for the few places that need actual records. `getCompanyProperties()` wraps the Properties API, used for schema introspection (property option discovery) rather than data queries. HubSpot API limits that shape the whole design: search pages cap at 100 rows and refuse to page past 10,000; filterGroups cap at 5 groups × 6 filters each (groups are OR'd, filters within a group are AND'd — see `buildFilterGroups()` in `src/lib/filters.ts`); there is no public GROUP BY, so per-owner counts are one count-only call per owner (~380 calls, ~75s cold), and filter-option discovery (Country/State dropdowns) is one count-only call per candidate enum value.

2. **Redis** (`src/lib/redis.ts`, `@upstash/redis`) — the durable store for everything the app writes, via `src/lib/rosterStore.ts` (roster assignments) and `src/lib/ownerCounts.ts` (the default-scope owner-count snapshot). **Required, not optional, once deployed**: Vercel functions have a read-only filesystem outside `/tmp`, and `/tmp` isn't guaranteed to persist between invocations — confirmed against Vercel's own docs after `data/roster.json` writes and the disk-based owner-count snapshot both silently broke on Vercel (see "Why Redis" below). `Redis.fromEnv()` reads `KV_REST_API_URL`/`KV_REST_API_TOKEN` (what the Vercel Marketplace "Redis" integration injects — Vercel KV itself is deprecated) or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (a direct Upstash account) automatically; it does not throw if they're missing, only warns and fails on first actual use, so the app still boots locally without Redis configured — `/api/overview` keeps working, anything touching the roster or owner counts returns a clean 500 instead of crashing the process.

3. **`data/roster.json`** — ships with the app as the **one-time seed** for a brand-new, empty Redis roster key (`roster:v1`). It is read-only at runtime now; nothing writes back to it. Edit it only to change what a *fresh* deployment seeds with — once Redis has a `roster:v1` key, this file is inert. `src/config/roster.ts` holds the things that are genuinely static code, not data: the `Role` enum, `ROLE_ORDER`, and `SYSTEM_OWNERS` (non-human bulk-import owners like `salesops .` that always get their own labeled bucket, never counted as a rep or silently folded into "unmapped").

### Why Redis (the Vercel deployment postmortem)

Deployed to Vercel, the Overview summary cards worked but Teams/Members/Validate failed with a generic "Unable to load HubSpot data" error. Root cause, confirmed against Vercel's docs rather than guessed:
- **Execution timeout**: the ~75-300s owner-count sweep exceeded Vercel's default function duration. `overview` was the one route that happened to keep working, because it was already deliberately built to *avoid* that sweep — that asymmetry was the tell. Fix: `export const maxDuration = 290` on every route that can hit the sweep (`teams`, `members`, `validate`, `filters`, `refresh`, `status`) — 290s fits under Hobby's 300s Fluid Compute ceiling.
- **Filesystem**: even with the timeout fixed, `data/roster.json` writes (`POST /api/roster`) and the `.cache/owner-counts.json` disk snapshot both fail on Vercel — read-only filesystem outside `/tmp`. This is why both moved to Redis rather than just raising `maxDuration`; a timeout fix alone would have left the Control Center's Add/Update form silently broken.
- **True hourly refresh isn't possible via Vercel Cron on the Hobby plan** — it only allows daily schedules there. `.github/workflows/hourly-refresh.yml` is the actual hourly trigger: a free GitHub Actions cron hitting `POST /api/refresh` (protected by a `CRON_SECRET` bearer-token check), which forces a fresh sweep and overwrites the Redis snapshot. `GET /api/status` exposes the snapshot's `computedAt` cheaply (no sweep) for the "Refreshed …" indicator in the top-right corner (`LastRefreshed.tsx`, formatted in `Asia/Kolkata`).

### Non-obvious HubSpot property facts baked into the code

These were wrong on a first pass (sometimes more than once) and cost real debugging time — don't second-guess them without re-verifying against the live portal:

- **Country**: use `country_dropdown` (an enumeration, single clean `"United States"` option, no spelling variants), not the free-text `country` property. This is a **deliberate, discussed tradeoff, not an oversight**: `country_dropdown` is known to mislabel some records (accounts tagged `country_dropdown='United States'` whose real free-text `country` says "Canada"/"India"), while free-text `country` is geographically self-consistent per record. The user was shown this evidence and explicitly chose `country_dropdown` anyway because it's what their external reporting already treats as ground truth (confirmed live: `country_dropdown='United States'` reproduces their reported baseline exactly). If accuracy complaints resurface, this is the first place to revisit — see the reasoning trail in `src/lib/filters.ts`'s doc comments before changing it back.
- **State**: use `state_drop_down`, not `overall_state_dropdown` or the free-text `state` — verified live as the best-populated of the three under the `country_dropdown` scope.
- **County**: **does not exist.** All 442 Company properties were scanned (name/label matching county/region/district/borough/fips/zone/territory) — nothing. Don't add a County filter/column without inventing one; if a future property is added in HubSpot, re-scan via `getCompanyProperties()` rather than guessing a name.
- **Dealership classification**: `type_of_dealership` is natively just `Franchise`/`Independent` (2 options, no third value). "In Group Dealership" as a third, mutually-exclusive category is a **derived business rule**, not a native property — group membership (`is_this_is_a_part_of_group_dealership_`) takes priority over type. See `classifyDealership()` in `src/lib/filters.ts`. Verified live that this composition reproduces the user's external baseline exactly (independent-not-in-group + franchise-not-in-group + in-group = total, no gaps, no double-counting).
- **Group dealership flag**: `is_this_is_a_part_of_group_dealership_` is an enum whose real stored value is `"true"`/`"false"`, plus a small legacy `"Yes"` bucket. HubSpot's own reporting UI displays this as `"Yes (true)"` / `"No (false)"` (label + value shown together for disambiguation) — that display string is **not** a filterable value; filtering on it silently returns ~0 rows. `GROUP_FLAG_TRUE = ["true", "Yes"]` in `src/lib/filters.ts` is correct; don't "fix" it back to the label form.
- **Group dealership hierarchy**: not modeled via HubSpot's native parent/child company association (`hs_parent_company_id` has zero adoption in this portal). It's tracked via custom properties `gd_id`/`gd_name` on each rooftop record.

### The filter scope, threaded everywhere

`FilterScope` (`{ country?, state?, city?, dealershipClass? }`, in `src/lib/types.ts`) is the one shared shape for "what's currently filtered." `parseFilterScope()` reads it from a request's `URLSearchParams`; `scopeCacheKey()` turns it into a stable cache key; `isDefaultScope()` identifies the unfiltered baseline (Country=United States, nothing else set) — only that scope gets the Redis warm-start snapshot (see below). Every API route parses the same scope from its own query string and every client component reads it from the URL via `useScopeParams()` (`src/lib/useScopeParams.ts`) — there's no prop-drilling of filter state; the URL is the single source of truth, set by `FilterPanel.tsx`'s Apply/Reset buttons.

### Server-side aggregation pipeline

`src/lib/ownerCounts.ts`'s `getOwnerCounts(scope)` is the expensive, load-bearing computation: one count call per HubSpot owner **scoped by the current filters**, cached 30 min in memory (keyed by `scopeCacheKey`) and — for the default scope only — snapshotted to Redis (key `owner-counts:snapshot:v${SNAPSHOT_SCHEMA_VERSION}`, 24h max age as an outer safety bound; real freshness comes from the hourly `/api/refresh` job, not this TTL) so a cold instance doesn't force a live recompute on every request. It asserts a reconciliation identity — `sum(per-owner counts) + unowned === total` — which is the app's actual correctness guarantee (surfaced on `/api/validate` and the Control Center page), not "pagination completeness," since counts never page at all.

Three caching bugs were caught live and are worth knowing about before touching this file:
- **The snapshot has no idea when its own meaning changes.** Switching the country property (above) silently kept serving the *old* definition's totals, because "is this snapshot stale" only checked age, not whether the logic that produced it was still current. `SNAPSHOT_SCHEMA_VERSION` is baked directly into the Redis key so a logic change simply reads from a different, empty key rather than needing an explicit version check — bump it whenever `computeOwnerCounts()`'s output would mean something different for the same scope.
- **`src/lib/cache.ts` caches the in-flight promise, not just the resolved value** — on purpose. Several components (`SummaryCards`, `TeamCards`, `RoleDistribution`, `MemberTable`) mount simultaneously and request the same scope before any of them resolves; caching only the resolved value let every one of them kick off its own duplicate ~75s sweep, which under real concurrent use (a live browser session plus a background check) stacked into multi-minute stalls on the shared HubSpot rate gate. If you ever "simplify" `cached()` back to storing just the value, this regresses.
- **`forceRefresh` has to explicitly `invalidate()` the in-memory cache entry first**, not just skip reading the Redis snapshot — `cached()` short-circuits on a fresh in-memory hit *before* the compute callback (where the `forceRefresh` check lives) ever runs. Without the explicit invalidation, `/api/refresh` calling `getOwnerCounts({}, true)` within 30 minutes of a normal page load could silently return the stale cached promise instead of actually recomputing.

`src/lib/aggregate.ts` takes an owner→count map plus the live roster (`rosterStore.ts`) and produces team/role/member/unmapped/system-bucket rollups in memory — no further HubSpot calls. Its exported field names still say `team` (not `pod`) on purpose: the roster store's concept is called "pod," but the Overview page and its API contracts were built before pods became dynamic, so the adapter layer keeps the old shape rather than renaming everything. Only the Control Center's pod-management UI (`AssignmentForm`, `PodPanel`, `PeopleTable`) speaks "pod" directly.

### API routes (`src/app/api/*/route.ts`)

Each returns pre-aggregated JSON, scoped by the request's filter params; the client never re-derives a total from a list of rows:
- `overview` — the cheap summary-card counts (total, independent/franchise/group classification, SalesOps), deliberately independent of `getOwnerCounts()` so it never blocks on the ~75s cold aggregate. No `maxDuration` override needed — a handful of `countCompanies()` calls, well under Vercel's default 10s.
- `teams`, `members`, `validate` — read from `getOwnerCounts(scope)` + `aggregate.ts`; `maxDuration = 290` since a non-default scope always computes live.
- `filters` — Country/State dropdown option discovery: every `country_dropdown`/`state_drop_down` enum value that actually has ≥1 matching company (not the raw ~80/~51-option enum lists), cached in Redis for 7 days (layered under the usual in-memory cache) since these essentially never change; `maxDuration = 290`.
- `refresh` (POST) — the hourly job's target, called by `.github/workflows/hourly-refresh.yml`, not Vercel Cron (Hobby plan only allows daily). Requires `Authorization: Bearer $CRON_SECRET`; forces `getOwnerCounts({}, true)` and overwrites the Redis snapshot. `maxDuration = 290`.
- `status` (GET) — cheap, reads the default-scope snapshot's `computedAt` for the "Refreshed …" UI indicator; falls through to a full live sweep (hence its own `maxDuration = 290`) only in the one-time case of an empty Redis store before the first refresh.
- `accounts` — the only endpoint returning actual company records (paginated, 100/page, filtered via `buildFilterGroups()`). No sweep, no override needed.
- `roster` (GET/POST), `roster/people` (GET) — the roster CRUD surface; `people` merges every real HubSpot owner with their current assignment (or the "Unassigned" defaults).
- `unmapped` — Control Center support endpoint.

### Frontend

App Router, plain CSS (`src/app/globals.css` holds the whole design system — cards, badges, avatars, tables, buttons, the sidebar filter panel; Apple/iOS-inspired typography and rounded-corner/pill-button styling; no Tailwind/CSS-in-JS). Small presentational primitives live in their own files and are reused throughout: `Icon.tsx`/`Avatar.tsx`/`Badge.tsx`/`Donut.tsx`. `src/lib/format.ts`'s `fmt()`/`fmtDate()` are the only place null/undefined/invalid values get turned into `—` for display — use them rather than ad hoc `?? "—"` checks so date parsing (HubSpot returns some date properties as epoch-ms strings and others as ISO strings) stays in one place.

Components fetch their own data client-side via the shared `useJson()` hook (`src/lib/useJson.ts`) rather than server-rendering with `fetch` — this keeps the fast summary cards from being blocked by the slow team/member sections, since each component's `useJson` call resolves independently. `useJson` also converts every fetch failure into one friendly, generic on-screen message and logs the real error to the console — never surface a raw status code or stack trace in the UI. Filter/drill-down state on the Overview page (`OverviewClient.tsx`) lives entirely in the URL's `searchParams` (`?team=&role=&ownerId=&country=&state=&city=&dealershipClass=`), so no client state library is needed and links are shareable.

When adding React state that depends on a prop changing (e.g. resetting pagination when a filter changes, prefilling a form when a different row is selected), follow the existing pattern of adjusting state during render (comparing against a `prev*`/`requestedFor`-style state value) rather than `useState` + `useEffect` — the lint config (`eslint-plugin-react-hooks`'s `set-state-in-effect`) rejects synchronous `setState` calls inside effects. See `AccountsTable.tsx` or `AssignmentForm.tsx` for the pattern.
