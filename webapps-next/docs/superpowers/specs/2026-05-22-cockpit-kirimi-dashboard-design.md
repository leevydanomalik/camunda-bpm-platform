# Cockpit Kirimi-Style Dashboard — Design

**Date:** 2026-05-22
**Author:** brainstormed with Claude
**Status:** Draft (pending user review)
**Scope:** Redesign `webapps-next/src/app/(app)/cockpit/page.tsx` (the Cockpit landing) to a Kirimi-style dashboard with rich visualizations. Existing data fetches and the `ExtensionSlot` plugin point are preserved.

## 1. Goals

1. Replace the current 3-stat + sidebar cockpit landing with a richer 6-KPI layout that mirrors the Kirimi reference (2 × 3 KPI grid, range filter, tabbed activity feed, plugin sidebar).
2. Add real visualizations driven by `engine-rest`: a timeseries area chart, a job-state donut, and two bar charts (top process definitions, top incident types).
3. Make time-relative metrics responsive to a `7D / 30D / 90D / Custom` selector without breaking the live ("right now") nature of state-based KPIs.
4. Keep the existing `ExtensionSlot` plugin contract intact so `plugins/sample-dashboard-widget/` keeps rendering.
5. Stay on the existing SSR-first pattern (RSC + `engineGet`) and add interactivity only where it earns its weight.

Out of scope:
- Touching the AngularJS legacy webapps in `webapps/frontend/`.
- Adding new history endpoints in `engine-rest/` — only consume existing ones.
- Building a generic charting framework. Charts are page-local.

## 2. Reference

Visual reference: Kirimi dashboard screenshot supplied by the user. Key patterns adopted:
- Personalized greeting header with subtitle.
- 2 × 3 KPI grid with icon, label, value, and a small trend / secondary line.
- Range selector chips in the top-right (7D / 30D / 90D / Custom).
- Tab strip with underline-active state.
- Card-based activity entries under the tabs.

## 3. Page Architecture

### 3.1 Routing

- Single page: `src/app/(app)/cockpit/page.tsx` (existing).
- Range state lives in the URL as `?range=7d|30d|90d|custom&from=ISO&to=ISO`.
  - Default: `range=7d` if absent.
  - `custom` requires `from` and `to`; if either is missing, fall back to `7d` and emit a console warning server-side.

### 3.2 Component tree

```
page.tsx (RSC, async)
├── DashboardHeader            (RSC — greeting + range selector link group)
│   └── RangeSelector          ("use client" — <Link> chips writing search params)
├── KpiGrid                    (RSC)
│   └── KpiCard × 6            (RSC)
├── ChartsRow                  (RSC, fetches aggregated data)
│   ├── InstancesTimeseriesCard  (server data → "use client" chart)
│   └── JobStateDonutCard        (server data → "use client" chart)
├── ChartsRowSecondary         (RSC)
│   ├── TopDefinitionsBarCard    (server data → "use client" chart)
│   └── TopIncidentsBarCard      (server data → "use client" chart)
├── two-column row
│   ├── ActivityTabs           ("use client", react-query)
│   └── PluginColumn           (RSC)
│       └── ExtensionSlot point="cockpit.dashboard.widget"
```

Server components fetch and pass plain data to client chart components. A "server data → client chart" pair means: an `async` RSC awaits the data and renders a thin `"use client"` chart component receiving the data as a prop. This keeps recharts off the server bundle without polling on the client.

### 3.3 Files added

- `src/app/(app)/cockpit/page.tsx` — rewritten.
- `src/app/(app)/cockpit/_components/dashboard-header.tsx`
- `src/app/(app)/cockpit/_components/range-selector.tsx` (client)
- `src/app/(app)/cockpit/_components/kpi-grid.tsx`
- `src/app/(app)/cockpit/_components/kpi-card.tsx`
- `src/app/(app)/cockpit/_components/instances-timeseries-card.tsx`
- `src/app/(app)/cockpit/_components/instances-timeseries-chart.tsx` (client, recharts)
- `src/app/(app)/cockpit/_components/job-state-donut-card.tsx`
- `src/app/(app)/cockpit/_components/job-state-donut-chart.tsx` (client, recharts)
- `src/app/(app)/cockpit/_components/top-definitions-bar-card.tsx`
- `src/app/(app)/cockpit/_components/top-definitions-bar-chart.tsx` (client, recharts)
- `src/app/(app)/cockpit/_components/top-incidents-bar-card.tsx`
- `src/app/(app)/cockpit/_components/top-incidents-bar-chart.tsx` (client, recharts)
- `src/app/(app)/cockpit/_components/activity-tabs.tsx` (client, react-query)
- `src/app/(app)/cockpit/_components/activity-tab-content.tsx` (client)
- `src/app/(app)/cockpit/_components/cockpit-query-provider.tsx` (client) — local `QueryClientProvider` wrapping `ActivityTabs`. There is no global one in `webapps-next` today; this scope keeps the cockpit dashboard self-contained.
- `src/app/(app)/cockpit/_components/range.ts` — shared `parseRange()` and `bucketize()` helpers (no React).
- `src/app/api/cockpit/activity/recent/route.ts` — unified recent activity (incidents + deployments + completed instances).
- `src/app/api/cockpit/activity/incidents/route.ts`
- `src/app/api/cockpit/activity/deployments/route.ts`
- `src/app/api/cockpit/activity/jobs/route.ts`
- `src/app/api/cockpit/activity/definitions/route.ts`

Existing file kept as-is:
- `src/lib/camunda/engine.ts` — `engineGet<T>` is the only engine helper used.

## 4. Data Contracts

### 4.1 Range parsing

`parseRange(searchParams)` returns `{ key: '7d'|'30d'|'90d'|'custom', from: Date, to: Date }` with `to = now` for the preset ranges. Buckets:
- `7d` → 7 daily buckets
- `30d` → 30 daily buckets
- `90d` → 13 weekly buckets (90 / 7, rounded)
- `custom` → daily buckets if span ≤ 31 days, weekly otherwise

### 4.2 KPI sources

| Card | Endpoint | Notes |
|---|---|---|
| Running instances | `GET /process-instance/count` | live count |
| Open incidents | `GET /incident/count` | warning tone if > 0 |
| Open user tasks | `GET /task/count` | live count |
| Failed jobs | `GET /job/count?withException=true&noRetriesLeft=true` | warning tone if > 0 |
| Active batches | `GET /batch/count?suspended=false` | live count |
| Deployments | `GET /deployment/count` | live total |

Trend delta per card: `GET /history/<resource>/count?startedAfter=<from>&startedBefore=<to>` minus the same query for the previous period of equal length. For state-based cards where "started in period" isn't meaningful (e.g., Active batches), the delta is omitted and the card shows only the value.

### 4.3 Chart sources

- **Instances timeseries**: bucket the range and run `GET /history/process-instance/count?startedAfter=<bucketStart>&startedBefore=<bucketEnd>` per bucket, in parallel. Server caps at the bucket count derived above (≤ 30 buckets). Result: `Array<{ bucketStart: ISO; count: number }>`.
- **Job state donut**: `GET /job/count?suspended=true`, `?withException=true&noRetriesLeft=true`, `?active=true`, `?withRetriesLeft=true&withException=false`. Result: `{ active, failed, suspended, retrying }`.
- **Top process definitions**: `GET /process-instance/count?processDefinitionKey=…` for the 5 most-deployed definitions (`GET /process-definition?latestVersion=true&sortBy=name&sortOrder=asc&maxResults=50` then re-rank by per-key running count). Result: `Array<{ key: string; name: string; count: number }>`.
- **Top incident types**: `GET /history/incident?startCreatedAfter=<from>&startCreatedBefore=<to>&maxResults=200`, then group by `incidentType` in the RSC and take the top 5. Result: `Array<{ type: string; count: number }>`.

### 4.4 Activity tabs

Each tab is a Next.js route handler returning a `{ items: Item[] }` JSON shape. The client `ActivityTabs` component is wrapped in `CockpitQueryProvider` (a local `QueryClientProvider` colocated with the dashboard — see §3.3) and uses `useQuery` keyed on `[tab, range]`. Endpoint paths under `/api/cockpit/activity/`:
- `recent` — `GET /history/process-instance?finished=true&sortBy=endTime&sortOrder=desc&maxResults=10`
- `incidents` — `GET /incident?sortBy=incidentTimestamp&sortOrder=desc&maxResults=10`
- `deployments` — `GET /deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=10`
- `jobs` — `GET /job?failedJobs=true&sortBy=jobDueDate&sortOrder=desc&maxResults=10`
- `definitions` — `GET /process-definition?latestVersion=true&sortBy=name&sortOrder=asc&maxResults=10`

Each route handler:
1. Reads the session cookie via the existing auth helper.
2. Calls `engineGet` server-side with appropriate query params.
3. Returns a typed `{ items }` payload.
4. On engine error returns `{ items: [] }` with HTTP 200 (the dashboard is tolerant — partial failure shouldn't blank the page).

## 5. Layout & Styling

- Tailwind 4 + shadcn primitives already in `src/components/ui/`.
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for the KPI row; `lg:grid-cols-3` with the timeseries spanning `lg:col-span-2` for the first chart row; `lg:grid-cols-2` for the second chart row; `lg:grid-cols-[1fr_320px]` for the tabs + plugin sidebar.
- Chart heights fixed via `h-64` / `h-72` to avoid layout shift.
- Colors come from existing CSS variables in `globals.css` (`--chart-1` … `--chart-5`). No hard-coded hexes.
- Range selector uses shadcn `<ToggleGroup>` styled with the underlined-pill pattern, wrapping `<Link>` so the SSR refresh works.
- Warning-toned KPIs (`Open incidents`, `Failed jobs`) reuse the existing `tone="warning"` styling.

## 6. Interaction & States

- **Loading**: Each chart card renders a skeleton (shadcn `<Skeleton>`) at the chart's resolved height while data resolves. The whole page uses Next.js streaming via async RSCs — the header and shell appear instantly, charts fill in.
- **Empty**: Each chart card shows a `<EmptyState>` (or shadcn `<Empty>`) with a short message ("No instances started in this period") when the data array is empty.
- **Engine unreachable**: KPI cards render `—` (matches existing `fmt(null)` behaviour). Charts render their empty state. Activity tabs show a banner: "Engine unreachable. Retrying when you switch tabs."
- **Range changes**: `<RangeSelector>` writes search params via `useRouter().replace(...)`. Server components re-fetch; client tabs re-query via `react-query` keyed on `range`.

## 7. Plugin Contract

The `ExtensionSlot point="cockpit.dashboard.widget"` is preserved verbatim and moves into the right sidebar column. `plugins/sample-dashboard-widget/` keeps working without changes. The plugin slot remains documented at the same path and entry point — no plugin author has to update anything.

## 8. Performance

- All RSC chart-data fetches run in `Promise.all` to parallelize. The timeseries fetch parallelizes its bucket queries internally.
- A worst-case 90D timeseries triggers 13 `count` calls; with 5 other parallel KPI calls + 4 chart queries + ~3 ancillary calls the dashboard stays under ~30 in-flight requests to engine-rest. Acceptable on local dev.
- No client polling. The dashboard refreshes on navigation or range change only.
- Recharts is dynamically imported via the `"use client"` chart components, so it never lands in the RSC bundle.

## 9. Accessibility

- KPI cards remain `<Link>`s and stay keyboard-reachable as today.
- Range selector is a `radiogroup` (via shadcn `<ToggleGroup type="single">`); each chip carries `aria-label`.
- Charts render an `aria-label` and a visually hidden table fallback (recharts `<Customized>` or a simple `<table>` sibling) for screen readers.
- Color is never the only signal: warning-tone KPIs also surface a label change ("⚠︎ 4 open incidents").

## 10. Testing

- Add a Playwright spec at `webapps-next/e2e/cockpit-dashboard.spec.ts` covering:
  1. The dashboard loads against the local engine and shows all 6 KPI cards.
  2. Switching from `7D` to `30D` re-fetches and updates the timeseries x-axis range.
  3. The `cockpit.dashboard.widget` ExtensionSlot still renders the sample widget.
  4. With a stubbed engine error (intercepted at the route handler level), KPIs render `—` and charts show empty state without crashing.
- No unit tests for the chart shells — they're thin wrappers around recharts; coverage lives at the e2e layer.

## 11. Open Questions / Future Work

- Timeseries bucketing might want a "Started vs Finished" overlay (two series on the area chart) — deferred until we have feedback on the single-series version.
- A real-time mode (e.g., 30s polling toggle) is not in scope but can be added later by promoting the KPI grid to a client island.
- Replacing the `recent` activity unified feed with a server-sent-events stream is a future-only consideration; out of scope now.

## 12. Migration Mirror

Legacy AngularJS Cockpit (`webapps/frontend/ui/cockpit/`) is unaffected. This redesign is `webapps-next/`-only and does not require a legacy port.
