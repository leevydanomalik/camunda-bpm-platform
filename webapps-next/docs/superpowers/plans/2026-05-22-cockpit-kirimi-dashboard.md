# Cockpit Kirimi-Style Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `webapps-next/src/app/(app)/cockpit/page.tsx` into a Kirimi-style dashboard with 6 KPI cards, a 7D/30D/90D/Custom range filter, four recharts visualisations (timeseries area, job-state donut, top-definitions bar, top-incident-types bar), a tabbed activity feed, and a plugin sidebar — preserving the existing `ExtensionSlot` plugin contract.

**Architecture:** Next.js App Router RSC page with thin `"use client"` chart islands and one client island for the tabs. Range state lives in the URL (`?range=7d`) so server components re-render on change. Recharts is already installed and there is a shadcn `chart.tsx` wrapper at `src/components/ui/chart.tsx`. Tab data is served by new route handlers under `src/app/api/cockpit/activity/` and fetched on the client via `@tanstack/react-query` behind a cockpit-scoped provider.

**Tech Stack:** Next.js 16 (App Router, React 19, RSC), TypeScript, Tailwind 4 + shadcn primitives, recharts ^2.15, `@tanstack/react-query` ^5.90, Playwright for e2e, Node v20 built-in test runner (`node --import tsx --test`) for pure helpers.

**Spec reference:** `webapps-next/docs/superpowers/specs/2026-05-22-cockpit-kirimi-dashboard-design.md`.

---

## File Structure

**Created**
```
webapps-next/src/app/(app)/cockpit/
├── page.tsx                                        ← rewritten in Task 4
└── _components/
    ├── range.ts                                    Task 1
    ├── range.test.ts                               Task 1
    ├── cockpit-query-provider.tsx                  Task 2
    ├── range-selector.tsx                          Task 3
    ├── dashboard-header.tsx                        Task 3
    ├── kpi-card.tsx                                Task 5
    ├── kpi-grid.tsx                                Task 5
    ├── instances-timeseries-card.tsx               Task 6
    ├── instances-timeseries-chart.tsx              Task 6
    ├── job-state-donut-card.tsx                    Task 7
    ├── job-state-donut-chart.tsx                   Task 7
    ├── top-definitions-bar-card.tsx                Task 8
    ├── top-definitions-bar-chart.tsx               Task 8
    ├── top-incidents-bar-card.tsx                  Task 9
    ├── top-incidents-bar-chart.tsx                 Task 9
    ├── activity-tabs.tsx                           Task 11
    └── activity-types.ts                           Task 10

webapps-next/src/app/api/cockpit/activity/
├── recent/route.ts                                 Task 10
├── incidents/route.ts                              Task 10
├── deployments/route.ts                            Task 10
├── jobs/route.ts                                   Task 10
└── definitions/route.ts                            Task 10

webapps-next/e2e/cockpit-dashboard.spec.ts          Task 12
```

**Modified**
- `webapps-next/src/app/(app)/cockpit/page.tsx` — full rewrite (Task 4), then small additions per chart/tab task.

**Untouched**
- `webapps-next/src/lib/camunda/engine.ts` — re-use `engineGet<T>` as-is.
- `webapps-next/src/lib/auth/session.ts` — re-use `getSession()` as-is.
- `webapps-next/plugins/sample-dashboard-widget/` — keeps rendering via the preserved `ExtensionSlot`.

**Working directory for all commands:** `/Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next`. Every Bash step assumes you `cd` there first.

---

## Task 1: Range parsing helpers

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/range.ts`
- Create: `webapps-next/src/app/(app)/cockpit/_components/range.test.ts`

- [ ] **Step 1: Write the failing test**

Create `webapps-next/src/app/(app)/cockpit/_components/range.test.ts`:

```ts
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { bucketize, parseRange, previousPeriod, RANGE_KEYS } from "./range";

describe("parseRange", () => {
  it("defaults to 7d when search param is absent", () => {
    const r = parseRange(new URLSearchParams(), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
    assert.equal(r.to.toISOString(), "2026-05-22T00:00:00.000Z");
    assert.equal(r.from.toISOString(), "2026-05-15T00:00:00.000Z");
  });

  it("accepts 30d preset", () => {
    const r = parseRange(new URLSearchParams("range=30d"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "30d");
    assert.equal(r.from.toISOString(), "2026-04-22T00:00:00.000Z");
  });

  it("accepts a valid custom range", () => {
    const r = parseRange(
      new URLSearchParams("range=custom&from=2026-05-01T00:00:00Z&to=2026-05-10T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.equal(r.key, "custom");
    assert.equal(r.from.toISOString(), "2026-05-01T00:00:00.000Z");
    assert.equal(r.to.toISOString(), "2026-05-10T00:00:00.000Z");
  });

  it("falls back to 7d when custom is missing bounds", () => {
    const r = parseRange(new URLSearchParams("range=custom"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
  });

  it("rejects unknown keys", () => {
    const r = parseRange(new URLSearchParams("range=banana"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(r.key, "7d");
  });

  it("exposes all preset keys", () => {
    assert.deepEqual([...RANGE_KEYS], ["7d", "30d", "90d", "custom"]);
  });
});

describe("bucketize", () => {
  it("produces 7 daily buckets for 7d", () => {
    const r = parseRange(new URLSearchParams("range=7d"), new Date("2026-05-22T00:00:00Z"));
    const buckets = bucketize(r);
    assert.equal(buckets.length, 7);
    assert.equal(buckets[0].start.toISOString(), "2026-05-15T00:00:00.000Z");
    assert.equal(buckets[6].end.toISOString(), "2026-05-22T00:00:00.000Z");
  });

  it("produces 30 daily buckets for 30d", () => {
    const r = parseRange(new URLSearchParams("range=30d"), new Date("2026-05-22T00:00:00Z"));
    assert.equal(bucketize(r).length, 30);
  });

  it("produces ~13 weekly buckets for 90d", () => {
    const r = parseRange(new URLSearchParams("range=90d"), new Date("2026-05-22T00:00:00Z"));
    const buckets = bucketize(r);
    assert.equal(buckets.length, 13);
  });

  it("custom range ≤31 days is daily; otherwise weekly", () => {
    const daily = parseRange(
      new URLSearchParams("range=custom&from=2026-05-01T00:00:00Z&to=2026-05-10T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.equal(bucketize(daily).length, 9);

    const weekly = parseRange(
      new URLSearchParams("range=custom&from=2026-01-01T00:00:00Z&to=2026-05-01T00:00:00Z"),
      new Date("2026-05-22T00:00:00Z"),
    );
    assert.ok(bucketize(weekly).length <= 18);
  });
});

describe("previousPeriod", () => {
  it("shifts the same span backwards in time", () => {
    const r = parseRange(new URLSearchParams("range=7d"), new Date("2026-05-22T00:00:00Z"));
    const prev = previousPeriod(r);
    assert.equal(prev.to.toISOString(), "2026-05-15T00:00:00.000Z");
    assert.equal(prev.from.toISOString(), "2026-05-08T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd webapps-next && npx tsx --test src/app/\(app\)/cockpit/_components/range.test.ts
```

Expected: FAIL with `Cannot find module './range'`.

- [ ] **Step 3: Write the implementation**

Create `webapps-next/src/app/(app)/cockpit/_components/range.ts`:

```ts
export const RANGE_KEYS = ["7d", "30d", "90d", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export type Range = {
  key: RangeKey;
  from: Date;
  to: Date;
};

const PRESET_DAYS: Record<Exclude<RangeKey, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isRangeKey(value: string | null): value is RangeKey {
  return value !== null && (RANGE_KEYS as readonly string[]).includes(value);
}

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Parse the cockpit dashboard's range search params.
 * Falls back to a 7-day window when the requested range is invalid.
 */
export function parseRange(params: URLSearchParams, now: Date = new Date()): Range {
  const raw = params.get("range");
  const key: RangeKey = isRangeKey(raw) ? raw : "7d";

  if (key === "custom") {
    const from = parseIso(params.get("from"));
    const to = parseIso(params.get("to"));
    if (from && to && from < to) {
      return { key: "custom", from, to };
    }
    return parseRange(new URLSearchParams("range=7d"), now);
  }

  const days = PRESET_DAYS[key];
  const to = now;
  const from = new Date(to.getTime() - days * DAY_MS);
  return { key, from, to };
}

export type Bucket = { start: Date; end: Date };

/**
 * Split a range into evenly-spaced buckets.
 * 7d → 7 daily; 30d → 30 daily; 90d → 13 weekly;
 * custom ≤31 days → daily; longer custom → weekly.
 */
export function bucketize(range: Range): Bucket[] {
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS);
  const weekly =
    range.key === "90d" || (range.key === "custom" && spanDays > 31);

  if (weekly) {
    const bucketCount = Math.max(1, Math.ceil(spanDays / 7));
    const bucketSpan = (range.to.getTime() - range.from.getTime()) / bucketCount;
    return Array.from({ length: bucketCount }, (_, i) => ({
      start: new Date(range.from.getTime() + i * bucketSpan),
      end: new Date(range.from.getTime() + (i + 1) * bucketSpan),
    }));
  }

  return Array.from({ length: spanDays }, (_, i) => ({
    start: new Date(range.from.getTime() + i * DAY_MS),
    end: new Date(range.from.getTime() + (i + 1) * DAY_MS),
  }));
}

/** Returns the same-length window immediately preceding `range`. */
export function previousPeriod(range: Range): Range {
  const span = range.to.getTime() - range.from.getTime();
  return {
    key: range.key,
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd webapps-next && npx tsx --test src/app/\(app\)/cockpit/_components/range.test.ts
```

Expected: all 11 tests pass.

- [ ] **Step 5: Lint and format**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/range.ts src/app/\(app\)/cockpit/_components/range.test.ts
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/range.ts \
        webapps-next/src/app/\(app\)/cockpit/_components/range.test.ts
git commit -m "feat(cockpit-dashboard): range parsing and bucketize helpers"
```

---

## Task 2: Cockpit-scoped React Query provider

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/cockpit-query-provider.tsx`

- [ ] **Step 1: Implement the provider**

Create `webapps-next/src/app/(app)/cockpit/_components/cockpit-query-provider.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Local QueryClientProvider for the cockpit dashboard.
 * No global provider exists in webapps-next today; this keeps
 * the dashboard self-contained and avoids forcing react-query
 * onto pages that don't need it.
 */
export function CockpitQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapps-next && npm run check
```

Expected: no Biome errors. (Type errors here would also fail.)

- [ ] **Step 3: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/cockpit-query-provider.tsx
git commit -m "feat(cockpit-dashboard): cockpit-scoped query client provider"
```

---

## Task 3: Range selector and dashboard header

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/range-selector.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/dashboard-header.tsx`

- [ ] **Step 1: Implement the range selector (client)**

Create `webapps-next/src/app/(app)/cockpit/_components/range-selector.tsx`:

```tsx
"use client";

import { useCallback } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { RANGE_KEYS, type RangeKey } from "./range";

const LABEL: Record<RangeKey, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  custom: "Custom",
};

export function RangeSelector({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (next: string) => {
      if (!next || next === value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      if (next !== "custom") {
        params.delete("from");
        params.delete("to");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, value],
  );

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={onChange}
      variant="outline"
      size="sm"
      className="bg-card rounded-full p-0.5"
      aria-label="Time range"
    >
      {RANGE_KEYS.map((key) => (
        <ToggleGroupItem
          key={key}
          value={key}
          aria-label={`Last ${LABEL[key].toLowerCase()}`}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full border-0 px-3 text-xs font-medium"
        >
          {LABEL[key]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

- [ ] **Step 2: Implement the header (server)**

Create `webapps-next/src/app/(app)/cockpit/_components/dashboard-header.tsx`:

```tsx
import type { RangeKey } from "./range";
import { RangeSelector } from "./range-selector";

export function DashboardHeader({ username, range }: { username: string; range: RangeKey }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>
        <p className="text-muted-foreground text-sm">Cockpit dashboard</p>
      </div>
      <RangeSelector value={range} />
    </header>
  );
}
```

- [ ] **Step 3: Lint**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/range-selector.tsx src/app/\(app\)/cockpit/_components/dashboard-header.tsx
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/range-selector.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/dashboard-header.tsx
git commit -m "feat(cockpit-dashboard): range selector and dashboard header"
```

---

## Task 4: Page rewrite (skeleton with placeholders)

The page rewrite happens now so subsequent tasks slot real components into known positions. Placeholder cards exist for KPI grid, charts, and tabs — each gets replaced in its own task.

**Files:**
- Modify (full rewrite): `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `webapps-next/src/app/(app)/cockpit/page.tsx` with:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

import { CockpitQueryProvider } from "./_components/cockpit-query-provider";
import { DashboardHeader } from "./_components/dashboard-header";
import { parseRange } from "./_components/range";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function paramsToSearch(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value) && value[0]) sp.set(key, value[0]);
  }
  return sp;
}

export default async function CockpitDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  const username = session?.username ?? "user";

  const sp = paramsToSearch(await searchParams);
  const range = parseRange(sp);

  return (
    <div className="space-y-6">
      <DashboardHeader username={username} range={range.key} />

      {/* KPI grid — replaced in Task 5 */}
      <PlaceholderCard title="KPI grid (Task 5)" height="h-32" />

      {/* Primary charts row — replaced in Tasks 6 & 7 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PlaceholderCard title="Instances timeseries (Task 6)" className="lg:col-span-2" height="h-72" />
        <PlaceholderCard title="Job state donut (Task 7)" height="h-72" />
      </div>

      {/* Secondary charts row — replaced in Tasks 8 & 9 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderCard title="Top process definitions (Task 8)" height="h-64" />
        <PlaceholderCard title="Top incident types (Task 9)" height="h-64" />
      </div>

      {/* Activity tabs + plugin sidebar — replaced in Task 11 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CockpitQueryProvider>
          <PlaceholderCard title="Activity tabs (Task 11)" height="h-72" />
        </CockpitQueryProvider>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom widgets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExtensionSlot point="cockpit.dashboard.widget" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlaceholderCard({
  title,
  height,
  className,
}: {
  title: string;
  height: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-muted-foreground bg-muted/30 flex ${height} items-center justify-center rounded text-xs`}
        >
          (placeholder)
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the page builds**

```bash
cd webapps-next && npm run check
```

Expected: no Biome errors.

- [ ] **Step 3: Smoke-test in the browser**

If the dev server is not running, the user starts it (`npm run dev`). Confirm `http://localhost:3000/cockpit` loads, shows the new "Welcome, demo" header with the range selector, and renders six placeholder cards.

- [ ] **Step 4: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): page skeleton with header, range selector, plugin slot"
```

---

## Task 5: KPI grid (6 cards with trend deltas)

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/kpi-card.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/kpi-grid.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement `KpiCard`**

Create `webapps-next/src/app/(app)/cockpit/_components/kpi-card.tsx`:

```tsx
import type { ReactNode } from "react";

import Link from "next/link";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "default" | "warning";

export type KpiDelta = {
  value: number; // signed; positive = increase vs previous period
  label: string; // e.g. "vs. last 7d"
};

export function KpiCard({
  href,
  icon,
  label,
  value,
  tone = "default",
  delta,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: number | null;
  tone?: KpiTone;
  delta?: KpiDelta;
}) {
  const isWarning = tone === "warning" && (value ?? 0) > 0;
  return (
    <Link
      href={href}
      className={cn(
        "group bg-card hover:border-primary/40 relative flex flex-col gap-4 rounded-xl border p-5 transition-colors",
        isWarning && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg",
            isWarning && "bg-destructive/10 text-destructive",
          )}
        >
          {icon}
        </div>
        <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground size-4 transition-colors" />
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-xs">{value === null ? "Engine unreachable" : label}</div>
        <div className={cn("text-3xl font-semibold tabular-nums", isWarning && "text-destructive")}>
          {value === null ? "—" : new Intl.NumberFormat().format(value)}
        </div>
        {delta && value !== null ? <DeltaPill delta={delta} /> : null}
      </div>
    </Link>
  );
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const positive = delta.value > 0;
  const negative = delta.value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : null;
  const tone = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : negative
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";
  return (
    <div className={cn("inline-flex items-center gap-1 text-xs font-medium", tone)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      <span className="tabular-nums">
        {delta.value > 0 ? "+" : ""}
        {new Intl.NumberFormat().format(delta.value)}
      </span>
      <span className="text-muted-foreground font-normal">{delta.label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement `KpiGrid` (server, fetches all six)**

Create `webapps-next/src/app/(app)/cockpit/_components/kpi-grid.tsx`:

```tsx
import {
  AlertTriangle,
  ClipboardList,
  Layers,
  Package,
  Play,
  XCircle,
} from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";

import { KpiCard, type KpiDelta } from "./kpi-card";
import { previousPeriod, type Range } from "./range";

type Count = { count: number };

async function safeCount(path: string): Promise<number | null> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return null;
  }
}

function isoNoMs(d: Date): string {
  // engine-rest accepts ISO 8601; strip milliseconds to keep URLs short.
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

async function safeDelta(
  historyPath: (from: string, to: string) => string,
  range: Range,
  label: string,
): Promise<KpiDelta | undefined> {
  const prev = previousPeriod(range);
  const [current, previous] = await Promise.all([
    safeCount(historyPath(isoNoMs(range.from), isoNoMs(range.to))),
    safeCount(historyPath(isoNoMs(prev.from), isoNoMs(prev.to))),
  ]);
  if (current === null || previous === null) return undefined;
  return { value: current - previous, label };
}

export async function KpiGrid({ range }: { range: Range }) {
  const deltaLabel = `vs. last ${range.key === "custom" ? "period" : range.key}`;

  const [
    runningInstances,
    openIncidents,
    openTasks,
    failedJobs,
    activeBatches,
    deployments,
    incidentsDelta,
    deploymentsDelta,
    instancesStartedDelta,
    tasksCompletedDelta,
  ] = await Promise.all([
    safeCount("/process-instance/count"),
    safeCount("/incident/count"),
    safeCount("/task/count"),
    safeCount("/job/count?withException=true&noRetriesLeft=true"),
    safeCount("/batch/count?suspended=false"),
    safeCount("/deployment/count"),
    safeDelta(
      (from, to) => `/history/incident/count?createTimeAfter=${from}&createTimeBefore=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta(
      // /deployment supports `after` / `before` filters on deploymentTime;
      // there is no /history/deployment endpoint in engine-rest.
      (from, to) => `/deployment/count?after=${from}&before=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta(
      (from, to) => `/history/process-instance/count?startedAfter=${from}&startedBefore=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta(
      (from, to) => `/history/task/count?finishedAfter=${from}&finishedBefore=${to}`,
      range,
      deltaLabel,
    ),
  ]);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        href="/cockpit/processes"
        icon={<Play className="size-4" />}
        label="Running instances"
        value={runningInstances}
        delta={instancesStartedDelta}
      />
      <KpiCard
        href="/cockpit/processes"
        icon={<AlertTriangle className="size-4" />}
        label="Open incidents"
        value={openIncidents}
        tone="warning"
        delta={incidentsDelta}
      />
      <KpiCard
        href="/cockpit/tasks"
        icon={<ClipboardList className="size-4" />}
        label="Open user tasks"
        value={openTasks}
        delta={tasksCompletedDelta}
      />
      <KpiCard
        href="/cockpit/processes"
        icon={<XCircle className="size-4" />}
        label="Failed jobs"
        value={failedJobs}
        tone="warning"
      />
      <KpiCard
        href="/cockpit/batches"
        icon={<Layers className="size-4" />}
        label="Active batches"
        value={activeBatches}
      />
      <KpiCard
        href="/cockpit/deployments"
        icon={<Package className="size-4" />}
        label="Deployments"
        value={deployments}
        delta={deploymentsDelta}
      />
    </div>
  );
}
```

- [ ] **Step 3: Slot `KpiGrid` into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, replace the placeholder:

```tsx
      {/* KPI grid — replaced in Task 5 */}
      <PlaceholderCard title="KPI grid (Task 5)" height="h-32" />
```

with:

```tsx
      <KpiGrid range={range} />
```

Add the import alongside the existing imports:

```tsx
import { KpiGrid } from "./_components/kpi-grid";
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/kpi-card.tsx src/app/\(app\)/cockpit/_components/kpi-grid.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — six KPI cards render with live values, four of them show a delta pill.

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/kpi-card.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/kpi-grid.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): six KPI cards with trend deltas"
```

---

## Task 6: Instances timeseries (area chart)

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/instances-timeseries-card.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/instances-timeseries-chart.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement the server fetcher card**

Create `webapps-next/src/app/(app)/cockpit/_components/instances-timeseries-card.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { InstancesTimeseriesChart, type TimeseriesPoint } from "./instances-timeseries-chart";
import { bucketize, type Range } from "./range";

type Count = { count: number };

function isoNoMs(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

async function fetchBucket(start: Date, end: Date): Promise<number> {
  try {
    const res = await engineGet<Count>(
      `/history/process-instance/count?startedAfter=${isoNoMs(start)}&startedBefore=${isoNoMs(end)}`,
    );
    return res.count;
  } catch {
    return 0;
  }
}

export async function InstancesTimeseriesCard({ range }: { range: Range }) {
  const buckets = bucketize(range);
  const counts = await Promise.all(buckets.map((b) => fetchBucket(b.start, b.end)));
  const data: TimeseriesPoint[] = buckets.map((b, i) => ({
    bucketStart: b.start.toISOString(),
    count: counts[i],
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Process instances started</CardTitle>
        <CardDescription className="text-xs">
          Over the selected range, bucketed {range.key === "90d" ? "weekly" : "daily"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstancesTimeseriesChart data={data} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the client chart**

Create `webapps-next/src/app/(app)/cockpit/_components/instances-timeseries-chart.tsx`:

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type TimeseriesPoint = { bucketStart: string; count: number };

const config: ChartConfig = {
  count: { label: "Started", color: "var(--chart-2)" },
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InstancesTimeseriesChart({ data }: { data: TimeseriesPoint[] }) {
  if (data.every((p) => p.count === 0)) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-64 items-center justify-center rounded text-xs">
        No instances started in this period.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cockpit-instances-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={32} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.bucketStart ? shortDate(payload[0].payload.bucketStart) : ""
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#cockpit-instances-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 3: Slot into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, inside the primary charts row, replace:

```tsx
        <PlaceholderCard title="Instances timeseries (Task 6)" className="lg:col-span-2" height="h-72" />
```

with:

```tsx
        <InstancesTimeseriesCard range={range} />
```

Add the import:

```tsx
import { InstancesTimeseriesCard } from "./_components/instances-timeseries-card";
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/instances-timeseries-card.tsx src/app/\(app\)/cockpit/_components/instances-timeseries-chart.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — area chart renders. Switch the range chip from 7D → 30D and confirm the x-axis range widens.

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/instances-timeseries-card.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/instances-timeseries-chart.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): process-instances timeseries area chart"
```

---

## Task 7: Job state donut chart

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/job-state-donut-card.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/job-state-donut-chart.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement the server fetcher card**

Create `webapps-next/src/app/(app)/cockpit/_components/job-state-donut-card.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { JobStateDonutChart, type JobStateSlice } from "./job-state-donut-chart";

type Count = { count: number };

async function safeCount(path: string): Promise<number> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return 0;
  }
}

export async function JobStateDonutCard() {
  const [failed, suspended, retrying, active] = await Promise.all([
    safeCount("/job/count?withException=true&noRetriesLeft=true"),
    safeCount("/job/count?suspended=true"),
    safeCount("/job/count?withException=true&withRetriesLeft=true"),
    safeCount("/job/count?withException=false&suspended=false"),
  ]);

  const data: JobStateSlice[] = [
    { state: "active", count: active },
    { state: "retrying", count: retrying },
    { state: "failed", count: failed },
    { state: "suspended", count: suspended },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Job state distribution</CardTitle>
        <CardDescription className="text-xs">Right now.</CardDescription>
      </CardHeader>
      <CardContent>
        <JobStateDonutChart data={data} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the client chart**

Create `webapps-next/src/app/(app)/cockpit/_components/job-state-donut-chart.tsx`:

```tsx
"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from "recharts";

import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type JobStateSlice = {
  state: "active" | "retrying" | "failed" | "suspended";
  count: number;
};

const config: ChartConfig = {
  active: { label: "Active", color: "var(--chart-2)" },
  retrying: { label: "Retrying", color: "var(--chart-3)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  suspended: { label: "Suspended", color: "var(--chart-5)" },
};

export function JobStateDonutChart({ data }: { data: JobStateSlice[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-64 items-center justify-center rounded text-xs">
        No jobs in the engine.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="state" />} />
          <Pie data={data} dataKey="count" nameKey="state" innerRadius={48} outerRadius={80} strokeWidth={1}>
            {data.map((slice) => (
              <Cell key={slice.state} fill={`var(--color-${slice.state})`} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => config[value as keyof typeof config]?.label ?? value}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 3: Slot into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, inside the primary charts row, replace:

```tsx
        <PlaceholderCard title="Job state donut (Task 7)" height="h-72" />
```

with:

```tsx
        <JobStateDonutCard />
```

Add the import:

```tsx
import { JobStateDonutCard } from "./_components/job-state-donut-card";
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/job-state-donut-card.tsx src/app/\(app\)/cockpit/_components/job-state-donut-chart.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — donut renders with up to four slices and a legend.

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/job-state-donut-card.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/job-state-donut-chart.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): job state donut chart"
```

---

## Task 8: Top process definitions bar chart

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/top-definitions-bar-card.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/top-definitions-bar-chart.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement the server fetcher card**

Create `webapps-next/src/app/(app)/cockpit/_components/top-definitions-bar-card.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { TopDefinitionsBarChart, type DefinitionRow } from "./top-definitions-bar-chart";

type ProcessDefinitionDto = {
  key: string;
  name: string | null;
};

type Count = { count: number };

async function safeCount(path: string): Promise<number> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return 0;
  }
}

export async function TopDefinitionsBarCard() {
  let defs: ProcessDefinitionDto[] = [];
  try {
    defs = await engineGet<ProcessDefinitionDto[]>(
      "/process-definition?latestVersion=true&active=true&sortBy=name&sortOrder=asc&maxResults=50",
    );
  } catch {
    defs = [];
  }

  const withCounts = await Promise.all(
    defs.map(async (d) => ({
      key: d.key,
      name: d.name ?? d.key,
      count: await safeCount(`/process-instance/count?processDefinitionKey=${encodeURIComponent(d.key)}`),
    })),
  );

  const data: DefinitionRow[] = withCounts
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top process definitions</CardTitle>
        <CardDescription className="text-xs">By running instance count.</CardDescription>
      </CardHeader>
      <CardContent>
        <TopDefinitionsBarChart data={data} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the client chart**

Create `webapps-next/src/app/(app)/cockpit/_components/top-definitions-bar-chart.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type DefinitionRow = { key: string; name: string; count: number };

const config: ChartConfig = {
  count: { label: "Running", color: "var(--chart-3)" },
};

export function TopDefinitionsBarChart({ data }: { data: DefinitionRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-56 items-center justify-center rounded text-xs">
        No running instances yet.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={120}
            tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 3: Slot into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, inside the secondary charts row, replace:

```tsx
        <PlaceholderCard title="Top process definitions (Task 8)" height="h-64" />
```

with:

```tsx
        <TopDefinitionsBarCard />
```

Add the import:

```tsx
import { TopDefinitionsBarCard } from "./_components/top-definitions-bar-card";
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/top-definitions-bar-card.tsx src/app/\(app\)/cockpit/_components/top-definitions-bar-chart.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — horizontal bar chart renders with up to 5 definitions.

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/top-definitions-bar-card.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/top-definitions-bar-chart.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): top process definitions bar chart"
```

---

## Task 9: Top incident types bar chart

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/top-incidents-bar-card.tsx`
- Create: `webapps-next/src/app/(app)/cockpit/_components/top-incidents-bar-chart.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement the server fetcher card**

Create `webapps-next/src/app/(app)/cockpit/_components/top-incidents-bar-card.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { type IncidentTypeRow, TopIncidentsBarChart } from "./top-incidents-bar-chart";
import { type Range } from "./range";

type HistoricIncidentDto = { incidentType: string };

function isoNoMs(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

export async function TopIncidentsBarCard({ range }: { range: Range }) {
  let incidents: HistoricIncidentDto[] = [];
  try {
    incidents = await engineGet<HistoricIncidentDto[]>(
      `/history/incident?createTimeAfter=${isoNoMs(range.from)}&createTimeBefore=${isoNoMs(range.to)}&maxResults=200`,
    );
  } catch {
    incidents = [];
  }

  const counts = new Map<string, number>();
  for (const i of incidents) {
    counts.set(i.incidentType, (counts.get(i.incidentType) ?? 0) + 1);
  }

  const data: IncidentTypeRow[] = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top incident types</CardTitle>
        <CardDescription className="text-xs">In the selected range.</CardDescription>
      </CardHeader>
      <CardContent>
        <TopIncidentsBarChart data={data} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the client chart**

Create `webapps-next/src/app/(app)/cockpit/_components/top-incidents-bar-chart.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type IncidentTypeRow = { type: string; count: number };

const config: ChartConfig = {
  count: { label: "Incidents", color: "var(--destructive)" },
};

export function TopIncidentsBarChart({ data }: { data: IncidentTypeRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-56 items-center justify-center rounded text-xs">
        No incidents in this period.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="type"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={140}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 3: Slot into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, inside the secondary charts row, replace:

```tsx
        <PlaceholderCard title="Top incident types (Task 9)" height="h-64" />
```

with:

```tsx
        <TopIncidentsBarCard range={range} />
```

Add the import:

```tsx
import { TopIncidentsBarCard } from "./_components/top-incidents-bar-card";
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/top-incidents-bar-card.tsx src/app/\(app\)/cockpit/_components/top-incidents-bar-chart.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — incident bar chart renders (or empty state if no incidents).

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/top-incidents-bar-card.tsx \
        webapps-next/src/app/\(app\)/cockpit/_components/top-incidents-bar-chart.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): top incident types bar chart"
```

---

## Task 10: Activity route handlers + shared types

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/activity-types.ts`
- Create: `webapps-next/src/app/api/cockpit/activity/recent/route.ts`
- Create: `webapps-next/src/app/api/cockpit/activity/incidents/route.ts`
- Create: `webapps-next/src/app/api/cockpit/activity/deployments/route.ts`
- Create: `webapps-next/src/app/api/cockpit/activity/jobs/route.ts`
- Create: `webapps-next/src/app/api/cockpit/activity/definitions/route.ts`

- [ ] **Step 1: Shared types**

Create `webapps-next/src/app/(app)/cockpit/_components/activity-types.ts`:

```ts
export type ActivityTab = "recent" | "incidents" | "deployments" | "jobs" | "definitions";

export type ActivityItem = {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string; // ISO
  tone?: "default" | "warning";
  href?: string;
};

export type ActivityResponse = { items: ActivityItem[] };
```

- [ ] **Step 2: `/recent` route — finished process instances**

Create `webapps-next/src/app/api/cockpit/activity/recent/route.ts`:

```ts
import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type HistoricInstanceDto = {
  id: string;
  processDefinitionName: string | null;
  processDefinitionKey: string;
  endTime: string | null;
  state: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<HistoricInstanceDto[]>(
      "/history/process-instance?finished=true&sortBy=endTime&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.processDefinitionName ?? d.processDefinitionKey,
      subtitle: d.state,
      timestamp: d.endTime ?? undefined,
      href: `/cockpit/processes/${encodeURIComponent(d.processDefinitionKey)}/instances/${encodeURIComponent(d.id)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
```

- [ ] **Step 3: `/incidents` route**

Create `webapps-next/src/app/api/cockpit/activity/incidents/route.ts`:

```ts
import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type IncidentDto = {
  id: string;
  incidentType: string;
  incidentMessage: string | null;
  incidentTimestamp: string;
  processDefinitionId: string;
  processInstanceId: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<IncidentDto[]>(
      "/incident?sortBy=incidentTimestamp&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.incidentType,
      subtitle: d.incidentMessage ?? undefined,
      timestamp: d.incidentTimestamp,
      tone: "warning",
      href: `/cockpit/processes/${encodeURIComponent(d.processDefinitionId)}/instances/${encodeURIComponent(d.processInstanceId)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
```

- [ ] **Step 4: `/deployments` route**

Create `webapps-next/src/app/api/cockpit/activity/deployments/route.ts`:

```ts
import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type DeploymentDto = {
  id: string;
  name: string | null;
  source: string | null;
  deploymentTime: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<DeploymentDto[]>(
      "/deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.name ?? d.id,
      subtitle: d.source ?? undefined,
      timestamp: d.deploymentTime,
      href: "/cockpit/deployments",
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
```

- [ ] **Step 5: `/jobs` route — failed jobs**

Create `webapps-next/src/app/api/cockpit/activity/jobs/route.ts`:

```ts
import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type JobDto = {
  id: string;
  jobDefinitionId: string;
  exceptionMessage: string | null;
  dueDate: string | null;
  processInstanceId: string | null;
  processDefinitionId: string | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<JobDto[]>(
      "/job?withException=true&noRetriesLeft=true&sortBy=jobDueDate&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.exceptionMessage ?? "Job failed",
      subtitle: d.jobDefinitionId,
      timestamp: d.dueDate ?? undefined,
      tone: "warning",
      href:
        d.processDefinitionId && d.processInstanceId
          ? `/cockpit/processes/${encodeURIComponent(d.processDefinitionId)}/instances/${encodeURIComponent(d.processInstanceId)}`
          : undefined,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
```

- [ ] **Step 6: `/definitions` route**

Create `webapps-next/src/app/api/cockpit/activity/definitions/route.ts`:

```ts
import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type ProcessDefinitionDto = {
  id: string;
  key: string;
  name: string | null;
  version: number;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<ProcessDefinitionDto[]>(
      "/process-definition?latestVersion=true&sortBy=name&sortOrder=asc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.name ?? d.key,
      subtitle: `v${d.version} · ${d.key}`,
      href: `/cockpit/processes/${encodeURIComponent(d.key)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
```

- [ ] **Step 7: Lint and curl-test one route**

```bash
cd webapps-next && npm run check
```

Expected: no errors. With the dev server running, hit:

```bash
curl -i --cookie 'camunda-next.session=<your-session>' http://localhost:3000/api/cockpit/activity/recent
```

(Or just open the URL in a tab where you're already logged in.) Expected: HTTP 200 with `{"items":[…]}`. An unauthenticated request returns HTTP 401.

- [ ] **Step 8: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/activity-types.ts \
        webapps-next/src/app/api/cockpit/activity/
git commit -m "feat(cockpit-dashboard): activity route handlers (recent, incidents, deployments, jobs, definitions)"
```

---

## Task 11: Activity tabs (client) + page wire-up

**Files:**
- Create: `webapps-next/src/app/(app)/cockpit/_components/activity-tabs.tsx`
- Modify: `webapps-next/src/app/(app)/cockpit/page.tsx`

- [ ] **Step 1: Implement `ActivityTabs`**

Create `webapps-next/src/app/(app)/cockpit/_components/activity-tabs.tsx`:

```tsx
"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { ActivityItem, ActivityResponse, ActivityTab } from "./activity-types";
import type { RangeKey } from "./range";

const TABS: { value: ActivityTab; label: string }[] = [
  { value: "recent", label: "Activity" },
  { value: "incidents", label: "Incidents" },
  { value: "deployments", label: "Deployments" },
  { value: "jobs", label: "Jobs" },
  { value: "definitions", label: "Definitions" },
];

async function fetchActivity(tab: ActivityTab): Promise<ActivityResponse> {
  const res = await fetch(`/api/cockpit/activity/${tab}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ActivityResponse;
}

export function ActivityTabs({ range: _range }: { range: RangeKey }) {
  const [active, setActive] = useState<ActivityTab>("recent");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={(v) => setActive(v as ActivityTab)}>
          <TabsList className="bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-full text-xs"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <ActivityList tab={t.value} active={active === t.value} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ActivityList({ tab, active }: { tab: ActivityTab; active: boolean }) {
  const query = useQuery({
    queryKey: ["cockpit-activity", tab],
    queryFn: () => fetchActivity(tab),
    enabled: active,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded p-3 text-xs">
        <AlertTriangle className="size-4" />
        Couldn't load activity. Switch tabs to retry.
      </div>
    );
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center justify-center rounded p-6 text-xs">
        Nothing to show here yet.
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const inner = (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm font-medium", item.tone === "warning" && "text-destructive")}>
          {item.title}
        </div>
        {item.subtitle ? (
          <div className="text-muted-foreground truncate text-xs">{item.subtitle}</div>
        ) : null}
      </div>
      {item.timestamp ? (
        <div className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
          <Clock className="size-3" />
          {new Date(item.timestamp).toLocaleString()}
        </div>
      ) : null}
    </div>
  );

  return item.href ? (
    <Link href={item.href} className="hover:bg-accent/40 -mx-2 block rounded px-2 transition-colors">
      {inner}
    </Link>
  ) : (
    <div className="-mx-2 px-2">{inner}</div>
  );
}
```

- [ ] **Step 2: Slot into the page**

In `webapps-next/src/app/(app)/cockpit/page.tsx`, replace:

```tsx
        <CockpitQueryProvider>
          <PlaceholderCard title="Activity tabs (Task 11)" height="h-72" />
        </CockpitQueryProvider>
```

with:

```tsx
        <CockpitQueryProvider>
          <ActivityTabs range={range.key} />
        </CockpitQueryProvider>
```

Add the import:

```tsx
import { ActivityTabs } from "./_components/activity-tabs";
```

- [ ] **Step 3: Remove the `PlaceholderCard` helper**

At this point no placeholder remains. Delete the `PlaceholderCard` function and its remaining call sites in `webapps-next/src/app/(app)/cockpit/page.tsx`. Search for `PlaceholderCard` and confirm zero references. The final `page.tsx` imports should look like:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

import { ActivityTabs } from "./_components/activity-tabs";
import { CockpitQueryProvider } from "./_components/cockpit-query-provider";
import { DashboardHeader } from "./_components/dashboard-header";
import { InstancesTimeseriesCard } from "./_components/instances-timeseries-card";
import { JobStateDonutCard } from "./_components/job-state-donut-card";
import { KpiGrid } from "./_components/kpi-grid";
import { parseRange } from "./_components/range";
import { TopDefinitionsBarCard } from "./_components/top-definitions-bar-card";
import { TopIncidentsBarCard } from "./_components/top-incidents-bar-card";
```

…and the page body should be:

```tsx
  return (
    <div className="space-y-6">
      <DashboardHeader username={username} range={range.key} />
      <KpiGrid range={range} />
      <div className="grid gap-4 lg:grid-cols-3">
        <InstancesTimeseriesCard range={range} />
        <JobStateDonutCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TopDefinitionsBarCard />
        <TopIncidentsBarCard range={range} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CockpitQueryProvider>
          <ActivityTabs range={range.key} />
        </CockpitQueryProvider>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom widgets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExtensionSlot point="cockpit.dashboard.widget" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
```

- [ ] **Step 4: Lint and smoke-test**

```bash
cd webapps-next && npm run check:fix -- src/app/\(app\)/cockpit/_components/activity-tabs.tsx src/app/\(app\)/cockpit/page.tsx
```

Expected: no errors. Reload `/cockpit` — the full dashboard renders end-to-end. Click each tab and confirm the activity list loads.

- [ ] **Step 5: Commit**

```bash
git add webapps-next/src/app/\(app\)/cockpit/_components/activity-tabs.tsx \
        webapps-next/src/app/\(app\)/cockpit/page.tsx
git commit -m "feat(cockpit-dashboard): tabbed activity feed and final page wire-up"
```

---

## Task 12: Playwright e2e coverage

**Files:**
- Create: `webapps-next/e2e/cockpit-dashboard.spec.ts`

- [ ] **Step 1: Confirm the e2e baseline**

```bash
cd webapps-next && ls e2e
```

If there is no `playwright.config.ts` or `e2e/` directory yet, check `webapps-next/package.json` — `test:e2e` already exists. If Playwright lacks a config, fall back to a minimal one at `webapps-next/playwright.config.ts` (only if absent):

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", port: 3000, reuseExistingServer: true, timeout: 120_000 },
});
```

Only add this file if it isn't already present — do not overwrite an existing config.

- [ ] **Step 2: Write the e2e spec**

Create `webapps-next/e2e/cockpit-dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "demo";
const PASSWORD = process.env.E2E_PASSWORD ?? "demo";

test.describe("Cockpit Kirimi-style dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/username/i).fill(USERNAME);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(cockpit|tasklist|admin)/);
  });

  test("renders header, range selector, six KPI cards, and plugin slot", async ({ page }) => {
    await page.goto("/cockpit");

    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    const selector = page.getByRole("group", { name: /time range/i });
    await expect(selector).toBeVisible();
    for (const label of ["7D", "30D", "90D", "Custom"]) {
      await expect(selector.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
    }

    // Six KPI labels (one card each).
    const kpiLabels = [
      "Running instances",
      "Open incidents",
      "Open user tasks",
      "Failed jobs",
      "Active batches",
      "Deployments",
    ];
    for (const label of kpiLabels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Sample plugin keeps rendering inside the Custom widgets slot.
    await expect(page.getByText(/custom widgets/i)).toBeVisible();
  });

  test("changing the range updates the URL and refreshes the timeseries", async ({ page }) => {
    await page.goto("/cockpit?range=7d");
    await page.getByRole("button", { name: /30d/i }).click();
    await expect(page).toHaveURL(/range=30d/);
    await expect(page.getByText(/process instances started/i)).toBeVisible();
  });

  test("activity tabs load their lists", async ({ page }) => {
    await page.goto("/cockpit");
    await expect(page.getByRole("tab", { name: /activity/i })).toBeVisible();
    for (const tab of ["Incidents", "Deployments", "Jobs", "Definitions", "Activity"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}$`, "i") }).click();
      // Either the empty-state message or a list item is acceptable; we just verify the panel rendered.
      await expect(
        page
          .getByText(/nothing to show here yet|couldn't load activity/i)
          .or(page.locator("ul li").first()),
      ).toBeVisible();
    }
  });

  test("tolerates engine errors on activity routes", async ({ page }) => {
    await page.route("**/api/cockpit/activity/incidents", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }),
    );
    await page.goto("/cockpit");
    await page.getByRole("tab", { name: /incidents/i }).click();
    await expect(page.getByText(/nothing to show here yet/i)).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the e2e suite**

Confirm the Camunda Run distro is up at `http://localhost:8080` and the Next.js dev server is reachable at `http://localhost:3000`, then:

```bash
cd webapps-next && npm run test:e2e -- cockpit-dashboard
```

Expected: all four tests pass.

- [ ] **Step 4: Commit**

```bash
git add webapps-next/e2e/cockpit-dashboard.spec.ts
# Also commit playwright.config.ts only if Step 1 created it.
git commit -m "test(cockpit-dashboard): playwright coverage for kirimi-style dashboard"
```

---

## Final Verification

After Task 12 completes, walk through this checklist manually:

- [ ] `/cockpit` loads on a fresh login and shows the personalized greeting (`Welcome, <username>`).
- [ ] The range selector switches between 7D / 30D / 90D and the URL reflects `?range=…`.
- [ ] All six KPI cards render values; warning-tone cards (Open incidents, Failed jobs) flip to the red treatment only when their value > 0.
- [ ] Each KPI with a delta shows a coloured trend pill (green up / red down / muted zero) and a sensible label.
- [ ] The four charts render against the local engine: timeseries area, job-state donut, top-definitions bar, top-incidents bar. Each shows its empty state when there is no data.
- [ ] All five activity tabs load on click and render rows or empty state.
- [ ] `plugins/sample-dashboard-widget` still renders inside the right sidebar's Custom widgets card.
- [ ] `npm run build` succeeds.
