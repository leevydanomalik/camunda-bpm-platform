# Phase 4a — Process Definition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Phase 4 row in roadmap §4.4 that scopes to *process definition* — running-instance counts on the list page, runtime-tab content (process instances, incidents, job definitions, called process definitions), the history view, definition-level actions (suspend/activate, update job priority), and the `cockpit-job-definition` plugin. Plus diagram overlays declared by the same plugin.

**Architecture:** Server components by default per §3.5; URL-driven tab routing via `searchParams.tab` and `searchParams.view` (runtime / history); mutations via `/api/cockpit/process-definitions/...` route handlers wrapping `engine-rest/process-definition/...`; `cockpit-job-definition` plugin registers into `cockpit.processDefinition.runtime.tab`, `cockpit.jobDefinition.action`, and a diagram-overlay slot. Diagram + heatmap reuse the existing `<BpmnViewer>` in `src/components/bpmn-viewer.tsx`.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, `bpmn-js` (already a dep), Playwright, Vitest.

**Spec / inventory:** [`docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md`](../specs/2026-05-21-webapps-migration-roadmap-design.md) §4.4 (process-definition rows) + §5.1 + §5.3.

**Preconditions:**
- All Phase 0 sub-plans merged (plugin contract, multi-engine, auth hardening, locale migration, distro).
- Phase 2 (tasklist completion) — so the tasklist-driven links from process-instance pages don't regress.
- Phase 3 (admin) — not strictly required but recommended for sidebar consistency.

---

## Constraints binding this plan

- **No auto-commit.** Default: stop after each task, summarize diff, wait for explicit "commit."
- **Camunda formation roles:**
  - **FE agent** owns every file under `webapps-next/src/**`, `webapps-next/e2e/**`, `webapps-next/plugins/**`.
  - **BE agent** invoked only for Task 0 (DTO confirmation).
  - **DevOps agent** runs every `npm`, Maven, and Playwright invocation.
- **Public API change rule (CLAUDE.md §6):** No JAX-RS signature changes. If `engine-rest` is missing a needed field, stop and dispatch BE — do not widen the contract.
- **Engine prerequisite:** Camunda Run on `localhost:8080`, fixture process `TestReview` (deployed by the Phase 2 globalSetup) plus at least one process with a *job definition* (an async-after activity, a timer event, or an async-before activity). Task 0 also ships a `JobsTimer.bpmn` fixture if absent.
- **`use client` discipline:** Page files server-rendered; only interactive controls (action menus, confirms, the heatmap toggle) live in `_components/*.tsx`.
- **Existing in-progress files:** Reconcile, don't rewrite (Task 1). The current `cockpit/processes/[key]/page.tsx` ships the diagram + activity badges + recent-instances list — extend, don't replace.

---

## Layout, Component & Typography Spec

Every page in this plan inherits the conventions below.

### Typography scale (Tailwind classes)

| Token | Class | When |
|---|---|---|
| `display` | `text-3xl font-semibold` | Stat counters (running instances, open incidents). |
| `h1` page title | `text-2xl font-semibold tracking-tight` | One per page, paired with `text-muted-foreground text-sm` subtitle. |
| `h2` section | inherits `<CardTitle>` (shadcn `text-base font-semibold`). |
| `h3` subsection | `text-sm font-medium` | Tab labels, stat-card titles. |
| `body-muted` | `text-muted-foreground text-sm` | Descriptions, empty states. |
| `caption` | `text-xs text-muted-foreground` | Timestamps, axis labels. |
| `code` inline | `bg-muted rounded px-1 text-xs font-mono` | Process keys, instance IDs, activity IDs, version tags. |
| `code` block | `bg-muted text-muted-foreground rounded p-3 text-xs font-mono` | Raw incident messages, stack traces. |

### Spacing scale

- Page vertical rhythm: `space-y-6`.
- Header block: `space-y-2` (back link + flex justify-between title row).
- Stat grid: `gap-4 md:grid-cols-2 lg:grid-cols-4`.
- Half-width grids: `gap-4 md:grid-cols-2`.
- Inside a Card with Table child: `<CardContent className="p-0">`.
- Tab bar margin: `mb-6`.

### Color tokens (semantic)

- Default: `text-foreground` (implicit).
- Muted: `text-muted-foreground`.
- Destructive: `text-destructive`, `variant="destructive"` (incidents, suspend confirms).
- Warning tone: `variant="destructive"` on Badge for `incidents > 0`; `variant="secondary"` otherwise.
- Hover card: `hover:border-primary/40 transition-colors`.

### Layout grid

**Processes list page (`/cockpit/processes`)** — single column:

```
┌──────────────────────────────────────────────────────────────┐
│  h1 "Processes"  +  subtitle                                  │
├──────────────────────────────────────────────────────────────┤
│  Card { Filter row: key search + tenant filter }              │
│  Card { Table:  Key | Version | Name | Instances | Incidents }│
└──────────────────────────────────────────────────────────────┘
```

**Process definition page (`/cockpit/processes/[key]`)** — header + diagram + tabs:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to processes                                          │
│  flex items-end justify-between:                              │
│    h1 + subtitle (key · v#)                          │  Action menu (suspend/job priority)
│                                                       │
├──────────────────────────────────────────────────────────────┤
│  Card { Diagram + heatmap toggle (Runtime ↔ All-time) }       │
├──────────────────────────────────────────────────────────────┤
│  View toggle:  [ Runtime ] [ History ]                        │
├──────────────────────────────────────────────────────────────┤
│  Tab strip: [ Instances ] [ Incidents ] [ Job defs ] [ Called definitions ] [ <plugin tabs> ]
├──────────────────────────────────────────────────────────────┤
│  Tab content (Card)                                           │
└──────────────────────────────────────────────────────────────┘
```

### Tab routing convention

- Active tab via `?tab=instances|incidents|job-definitions|called-definitions|<plugin-id>`.
- Active view via `?view=runtime|history`.
- Tabs render as `<Link>` styled like segmented control; active gets `bg-background shadow-sm`.
- Default tab when `?tab` absent: `instances`.
- Default view: `runtime`.

### Component composition rules

| Pattern | Use | Don't |
|---|---|---|
| Tab strip | `<nav className="inline-flex bg-muted rounded-md p-0.5">` with `<Link>` children. | Client-side state for which tab is active. |
| Stat header next to title | Right-aligned badge cluster (`flex flex-wrap gap-2`) with counts. | Inline body text for counts. |
| Action menu | `<DropdownMenu>` with a `<Button variant="outline" size="sm">`. | Buttons sprayed in the header row. |
| Definition-level destructive action | `<Dialog>` confirm + type-key-to-confirm. | `window.confirm`. |
| Plugin slot | `<ExtensionSlot point="cockpit.processDefinition.runtime.tab" props={{ definitionId, definitionKey }} />`. | Inlined tab lists. |
| Empty state | `<div className="text-muted-foreground p-6 text-sm">No X.</div>` inside `<CardContent>`. | Spinner placeholders. |

### Iconography (lucide-react)

| Domain | Icon |
|---|---|
| Process / workflow | `Workflow` |
| Running instance | `Play` |
| Incident | `AlertTriangle`, `AlertCircle` |
| Job definition / timer | `Clock`, `Cog` |
| Suspend / resume | `Pause`, `Play` |
| Retry | `RotateCcw` |
| Increase / decrease priority | `ArrowUp`, `ArrowDown` |
| Called definitions | `GitBranch` |
| History | `History` |
| Tabs default | none — labels only |

Size: `size-4` in buttons, `size-5` in card headers, `size-3` in dense badges.

### Tables

- Card-wrapped, `<CardContent className="p-0">`.
- Visible columns ≤ 5 (instances table: Instance ID · Business key · State · Started · Open). Mono ID column.
- Row link: first cell wraps `<Link>` to the related detail page (`/cockpit/processes/[key]/instances/[id]`).
- No virtualization in v1; cap server-side at `maxResults=500` per tab fetch (matches legacy).

### Responsive bar

- Only `md:` and `lg:` breakpoints. Stat grid collapses to 1-col below `md:`. Tab strip becomes a `<Select>` switcher below `md:` (server-side: render different fragment based on `Accept-CH` headers? — out of scope; just let the strip wrap with `flex-wrap`).

---

## File Structure

**Already exists (reconciled):**

| File | Current | Delta |
|---|---|---|
| `src/app/(app)/cockpit/processes/page.tsx` | List with definitions, no counts | Add running-instance count + open-incident count columns; tenant filter. |
| `src/app/(app)/cockpit/processes/[key]/page.tsx` | Header + diagram + activity badges + recent instances list | Refactor into: header + diagram + tab strip + tab content. Move recent-instances list into the `instances` tab. Add view (runtime/history) toggle. Add action menu. |
| `src/components/bpmn-viewer.tsx` | bpmn-js wrapper | No changes (already supports badges + heatmap). |

**Net-new — pages / route segments:**

| File | Responsibility |
|---|---|
| `src/app/(app)/cockpit/processes/[key]/_components/tab-strip.tsx` | URL-driven segmented control + `<ExtensionSlot point="cockpit.processDefinition.runtime.tab" />` for plugin tabs. |
| `src/app/(app)/cockpit/processes/[key]/_components/instances-tab.tsx` | Tab body: paginated runtime instances table. Re-uses logic from current page. |
| `src/app/(app)/cockpit/processes/[key]/_components/incidents-tab.tsx` | Tab body: incident list with retry/resolve actions. |
| `src/app/(app)/cockpit/processes/[key]/_components/job-definitions-tab.tsx` | Tab body: job definitions + actions (suspend, update priority). |
| `src/app/(app)/cockpit/processes/[key]/_components/called-definitions-tab.tsx` | Tab body: list of definitions where this is the caller. |
| `src/app/(app)/cockpit/processes/[key]/_components/history-instances-tab.tsx` | History view — historic process instances. |
| `src/app/(app)/cockpit/processes/[key]/_components/view-toggle.tsx` | Runtime / History segmented control. |
| `src/app/(app)/cockpit/processes/[key]/_components/definition-actions-menu.tsx` | Dropdown: Suspend definition / Activate / Set job priority. Triggers confirm dialogs. |
| `src/app/(app)/cockpit/processes/[key]/_components/suspend-definition-dialog.tsx` | Confirm dialog for suspend/activate. |
| `src/app/(app)/cockpit/processes/[key]/_components/incident-retry-button.tsx` | Per-incident retry action (POST `/job/{jobId}/retries`). |
| `src/app/(app)/cockpit/processes/[key]/_components/job-priority-dialog.tsx` | Confirm dialog for setting a job definition's priority. |

**Net-new — route handlers:**

| File | Methods | Backend |
|---|---|---|
| `src/app/api/cockpit/process-definitions/[id]/suspended/route.ts` | PUT | `engine-rest/process-definition/{id}/suspended` |
| `src/app/api/cockpit/job-definitions/[id]/suspended/route.ts` | PUT | `engine-rest/job-definition/{id}/suspended` |
| `src/app/api/cockpit/job-definitions/[id]/jobPriority/route.ts` | PUT | `engine-rest/job-definition/{id}/jobPriority` |
| `src/app/api/cockpit/jobs/[id]/retries/route.ts` | PUT | `engine-rest/job/{id}/retries` |
| `src/app/api/cockpit/incidents/[id]/resolve/route.ts` | DELETE | `engine-rest/incident/{id}` (delete == resolve) |

**Net-new — plugin (cockpit-job-definition):**

| File | Responsibility |
|---|---|
| `plugins/cockpit-job-definition/plugin.json` | Registers `cockpit.processDefinition.runtime.tab` (Jobs tab variant), `cockpit.jobDefinition.action` (action menu items), and a diagram-overlay slot `cockpit.processDefinition.diagram.overlay` for job-suspension overlay. |
| `plugins/cockpit-job-definition/client.tsx` | Three named exports: `JobsTabPanel`, `JobActionMenuItems`, `JobSuspensionOverlay`. |

**Net-new — e2e:**

| File |
|---|
| `e2e/cockpit-process-definition.spec.ts` |
| `e2e/cockpit-process-definition-actions.spec.ts` |
| `e2e/cockpit-job-definition-plugin.spec.ts` |
| `e2e/_fixtures/jobs-timer.bpmn` (fixture with a timer event for job-definition tests) |

**Not touched (explicit):** `engine.ts`, `session.ts`, `proxy.ts`, `(app)/layout.tsx`, any shadcn primitive, any Java file.

---

## Task 0: BE handoff — confirm DTOs + endpoints

**Files:** none (read-only)

- [ ] **Step 1: Dispatch BE persona**

> Read-only investigation. Confirm shapes from `engine-rest/engine-rest/src/main/java/org/camunda/bpm/engine/rest/`:
> 1. `ProcessDefinitionStatisticsResultDto` — fields `id` (definitionId), `instances`, `failedJobs`, `incidents[]`. Confirm `incidents[]` includes `incidentType` and `incidentCount`.
> 2. `JobDefinitionDto` — fields `id`, `processDefinitionId`, `activityId`, `jobType`, `jobConfiguration`, `overridingJobPriority`, `suspended`, `tenantId`.
> 3. `JobDefinitionSuspensionStateDto` — request shape for PUT `/job-definition/{id}/suspended` (includes `suspended: bool`, `includeJobs: bool`, `executionDate: string?`).
> 4. `JobDefinitionPriorityDto` — request shape for PUT `/job-definition/{id}/jobPriority` (`priority: long?`, `includeJobs: bool`).
> 5. `ProcessDefinitionSuspensionStateDto` — request shape for PUT `/process-definition/{id}/suspended`.
> 6. `IncidentDto` — fields, especially `executionId`, `processInstanceId`, `incidentMessage`, `failedActivityId`, `causeIncidentId`, `rootCauseIncidentId`, `configuration` (job id).
> 7. `HistoricProcessInstanceDto` — fields for the history tab.
> 8. Confirm `/process-definition?superProcessDefinitionId={id}` returns the called definitions list (this is how legacy enumerates).
>
> Return markdown report under `docs/superpowers/specs/evidence/phase-4a/be-dto-report.md`.

- [ ] **Step 2: Commit the report**

```bash
git add docs/superpowers/specs/evidence/phase-4a/be-dto-report.md
git commit -m "docs(phase-4a): capture process-definition DTOs and suspension/priority shapes"
```

---

## Task 1: Reconcile

**Files:**
- Read: `src/app/(app)/cockpit/processes/page.tsx`, `[key]/page.tsx`, `src/components/bpmn-viewer.tsx`
- Write: `docs/superpowers/specs/evidence/phase-4a/reconcile.md`

- [ ] **Step 1: Read each file**

Confirm current behavior matches the "Already exists" delta description.

- [ ] **Step 2: Write reconcile.md**

For each task in this plan, one line: status + blockers.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-4a/reconcile.md
git commit -m "docs(phase-4a): reconcile in-progress state vs. plan"
```

---

## Task 2: Processes list — add instance + incident counts

**Files:**
- Modify: `src/app/(app)/cockpit/processes/page.tsx`

- [ ] **Step 1: Add a counts join**

Extend `loadDefinitions` to also call `/process-definition/statistics?failedJobs=true&incidents=true` and join by definition id.

```tsx
type Stats = { id: string; instances: number; failedJobs: number; incidents?: Array<{ incidentType: string; incidentCount: number }> };

async function loadStats(): Promise<Record<string, Stats>> {
  try {
    const list = await engineGet<Stats[]>(`/process-definition/statistics?failedJobs=true&incidents=true`);
    return Object.fromEntries(list.map((s) => [s.id, s]));
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Render new columns**

Add `Running` and `Incidents` columns to the existing table. Render badge for incidents > 0 with `variant="destructive"`.

```tsx
<TableHead>Running</TableHead>
<TableHead>Incidents</TableHead>
// ...
<TableCell>{stats[def.id]?.instances ?? 0}</TableCell>
<TableCell>
  {totalIncidents(stats[def.id]) > 0 ? <Badge variant="destructive">{totalIncidents(stats[def.id])}</Badge> : "—"}
</TableCell>
```

`totalIncidents(s)` sums `incidents[].incidentCount`.

- [ ] **Step 3: Optional tenant filter**

If `?tenantId=` present, restrict the definition list. Otherwise show all.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/page.tsx
git commit -m "feat(cockpit): processes list — running + incident counts"
```

---

## Task 3: Process definition page — refactor into tabs

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/page.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/tab-strip.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/view-toggle.tsx`

- [ ] **Step 1: Tab strip**

```tsx
import Link from "next/link";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

const TABS = [
  { key: "instances", label: "Instances" },
  { key: "incidents", label: "Incidents" },
  { key: "job-definitions", label: "Job definitions" },
  { key: "called-definitions", label: "Called definitions" },
];

export function TabStrip({ active, definitionKey, definitionId, view }: { active: string; definitionKey: string; definitionId: string; view: string }) {
  return (
    <nav className="inline-flex items-center rounded-md bg-muted p-0.5 text-sm">
      {TABS.map((t) => {
        const params = new URLSearchParams({ tab: t.key, view });
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`/cockpit/processes/${encodeURIComponent(definitionKey)}?${params.toString()}`}
            className={`rounded-sm px-3 py-1.5 ${isActive ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
      {/* Plugin-provided tabs */}
      <ExtensionSlot
        point="cockpit.processDefinition.runtime.tab"
        props={{ definitionId, definitionKey, active, view }}
        fallback={null}
      />
    </nav>
  );
}
```

- [ ] **Step 2: View toggle**

```tsx
import Link from "next/link";

export function ViewToggle({ view, definitionKey, tab }: { view: "runtime" | "history"; definitionKey: string; tab: string }) {
  const make = (v: "runtime" | "history") => {
    const p = new URLSearchParams({ tab, view: v });
    return `/cockpit/processes/${encodeURIComponent(definitionKey)}?${p.toString()}`;
  };
  return (
    <div className="inline-flex items-center rounded-md bg-muted p-0.5 text-xs">
      <Link href={make("runtime")} className={`rounded-sm px-2.5 py-1 ${view === "runtime" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Runtime</Link>
      <Link href={make("history")} className={`rounded-sm px-2.5 py-1 ${view === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>History</Link>
    </div>
  );
}
```

- [ ] **Step 3: Refactor the page**

```tsx
// Keep loadDefinition/loadDiagram/loadActivityStatistics/buildBadges/normalizeToHeatmap helpers as-is.
// Remove the inline "Running instances" Card and reroute it into <InstancesTab />.

import { InstancesTab } from "./_components/instances-tab";
import { IncidentsTab } from "./_components/incidents-tab";
import { JobDefinitionsTab } from "./_components/job-definitions-tab";
import { CalledDefinitionsTab } from "./_components/called-definitions-tab";
import { HistoryInstancesTab } from "./_components/history-instances-tab";
import { TabStrip } from "./_components/tab-strip";
import { ViewToggle } from "./_components/view-toggle";
import { DefinitionActionsMenu } from "./_components/definition-actions-menu";

const ALLOWED_TABS = ["instances", "incidents", "job-definitions", "called-definitions"] as const;

export default async function ProcessDefinitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ heat?: string; tab?: string; view?: string }>;
}) {
  const { key } = await params;
  const { heat, tab: rawTab, view: rawView } = await searchParams;
  const view: "runtime" | "history" = rawView === "history" ? "history" : "runtime";
  const tab = (ALLOWED_TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as (typeof ALLOWED_TABS)[number]) : "instances";

  const def = await loadDefinition(key);
  if (!def) return /* NotFound block as today */;

  const [xml, stats, historyCounts] = await Promise.all([
    loadDiagram(def.id),
    loadActivityStatistics(def.id),
    heat === "history" ? loadHistoricActivityCounts(def.id) : Promise.resolve({} as Record<string, number>),
  ]);
  const heatMode: "runtime" | "history" = heat === "history" ? "history" : "runtime";

  return (
    <div className="space-y-6">
      {/* Back link + header — keep existing markup */}

      {/* Diagram Card — keep existing markup with toggle */}

      <div className="flex items-center justify-between gap-3">
        <ViewToggle view={view} definitionKey={def.key} tab={tab} />
        <DefinitionActionsMenu definitionId={def.id} definitionKey={def.key} suspended={def.suspended} />
      </div>

      <TabStrip active={tab} definitionKey={def.key} definitionId={def.id} view={view} />

      {view === "runtime" && tab === "instances" && <InstancesTab definitionId={def.id} definitionKey={def.key} />}
      {view === "runtime" && tab === "incidents" && <IncidentsTab definitionId={def.id} />}
      {view === "runtime" && tab === "job-definitions" && <JobDefinitionsTab definitionId={def.id} />}
      {view === "runtime" && tab === "called-definitions" && <CalledDefinitionsTab definitionId={def.id} />}
      {view === "history" && <HistoryInstancesTab definitionId={def.id} />}
    </div>
  );
}
```

- [ ] **Step 4: Commit (page + new components stubs as empty)**

Create empty placeholder files for each tab component before committing so the import graph compiles.

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/page.tsx src/app/\(app\)/cockpit/processes/\[key\]/_components/{tab-strip,view-toggle}.tsx src/app/\(app\)/cockpit/processes/\[key\]/_components/{instances-tab,incidents-tab,job-definitions-tab,called-definitions-tab,history-instances-tab}.tsx
git commit -m "refactor(cockpit): process-definition page → tab routing + view toggle"
```

---

## Task 4: Instances tab

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/_components/instances-tab.tsx`

- [ ] **Step 1: Server component pulling /process-instance**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";

type Instance = { id: string; businessKey: string | null; definitionId: string; startTime?: string; state?: string; suspended: boolean };

async function loadInstances(definitionId: string): Promise<Instance[]> {
  try {
    return await engineGet<Instance[]>(
      `/process-instance?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=200&sortBy=startTime&sortOrder=desc`,
    );
  } catch {
    return [];
  }
}

export async function InstancesTab({ definitionId, definitionKey }: { definitionId: string; definitionKey: string }) {
  const instances = await loadInstances(definitionId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Running instances</CardTitle>
        <CardDescription>{instances.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {instances.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No running instances.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance ID</TableHead>
                <TableHead>Business key</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/cockpit/processes/${encodeURIComponent(definitionKey)}/instances/${encodeURIComponent(i.id)}`}
                      className="hover:underline"
                    >
                      {i.id}
                    </Link>
                  </TableCell>
                  <TableCell>{i.businessKey ?? "—"}</TableCell>
                  <TableCell>
                    {i.suspended ? <Badge variant="outline">Suspended</Badge> : <Badge variant="secondary">{i.state ?? "Active"}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/_components/instances-tab.tsx
git commit -m "feat(cockpit): process-definition instances tab"
```

---

## Task 5: Incidents tab

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/_components/incidents-tab.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/incident-retry-button.tsx`
- Create: `src/app/api/cockpit/jobs/[id]/retries/route.ts`
- Create: `src/app/api/cockpit/incidents/[id]/resolve/route.ts`

- [ ] **Step 1: Routes**

`src/app/api/cockpit/jobs/[id]/retries/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({ retries: 1 }));
  const res = await engineFetch(`/job/${encodeURIComponent(id)}/retries`, { method: "PUT", body: JSON.stringify({ retries: body.retries ?? 1 }) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

`src/app/api/cockpit/incidents/[id]/resolve/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/incident/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Retry button**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function IncidentRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  const click = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/jobs/${encodeURIComponent(jobId)}/retries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retries: 1 }),
      });
      if (res.ok) { setOk(true); router.refresh(); }
    });

  return (
    <Button size="sm" variant="outline" disabled={pending || ok} onClick={click}>
      <RotateCcw className="mr-1 size-4" /> {ok ? "Retried" : "Retry"}
    </Button>
  );
}
```

- [ ] **Step 3: Incidents tab**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";
import { IncidentRetryButton } from "./incident-retry-button";

type Incident = {
  id: string;
  processInstanceId: string;
  incidentType: string;
  incidentMessage: string | null;
  failedActivityId: string | null;
  configuration: string | null; // jobId for failedJob incidents
  rootCauseIncidentId: string | null;
};

async function load(definitionId: string): Promise<Incident[]> {
  try {
    return await engineGet<Incident[]>(`/incident?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=200`);
  } catch {
    return [];
  }
}

export async function IncidentsTab({ definitionId }: { definitionId: string }) {
  const list = await load(definitionId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open incidents</CardTitle>
        <CardDescription>{list.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No incidents.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Process instance</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><Badge variant="destructive">{i.incidentType}</Badge></TableCell>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{i.failedActivityId ?? "—"}</code></TableCell>
                  <TableCell className="max-w-md truncate text-xs">{i.incidentMessage ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{i.processInstanceId}</TableCell>
                  <TableCell>
                    {i.incidentType === "failedJob" && i.configuration ? (
                      <IncidentRetryButton jobId={i.configuration} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cockpit/jobs src/app/api/cockpit/incidents src/app/\(app\)/cockpit/processes/\[key\]/_components/{incidents-tab,incident-retry-button}.tsx
git commit -m "feat(cockpit): process-definition incidents tab + retry"
```

---

## Task 6: Job definitions tab + actions

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/_components/job-definitions-tab.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/job-priority-dialog.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/job-suspension-button.tsx`
- Create: `src/app/api/cockpit/job-definitions/[id]/suspended/route.ts`
- Create: `src/app/api/cockpit/job-definitions/[id]/jobPriority/route.ts`

- [ ] **Step 1: Routes**

```ts
// suspended/route.ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json(); // { suspended, includeJobs, executionDate? }
  const res = await engineFetch(`/job-definition/${encodeURIComponent(id)}/suspended`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

```ts
// jobPriority/route.ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json(); // { priority: number|null, includeJobs: boolean }
  const res = await engineFetch(`/job-definition/${encodeURIComponent(id)}/jobPriority`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Suspension button**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

export function JobSuspensionButton({ id, suspended }: { id: string; suspended: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const click = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/job-definitions/${encodeURIComponent(id)}/suspended`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !suspended, includeJobs: true }),
      });
      if (res.ok) router.refresh();
    });
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={click}>
      {suspended ? <Play className="mr-1 size-4" /> : <Pause className="mr-1 size-4" />}
      {suspended ? "Activate" : "Suspend"}
    </Button>
  );
}
```

- [ ] **Step 3: Priority dialog**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JobPriorityDialog({ id, currentPriority }: { id: string; currentPriority: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentPriority ?? ""));
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const priority = value === "" ? null : Number(value);
      const res = await fetch(`/api/cockpit/job-definitions/${encodeURIComponent(id)}/jobPriority`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority, includeJobs: true }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Set priority</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Override job priority</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Priority (integer, blank to clear)</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Tab**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";
import { JobSuspensionButton } from "./job-suspension-button";
import { JobPriorityDialog } from "./job-priority-dialog";

type JobDef = {
  id: string;
  activityId: string;
  jobType: string;
  jobConfiguration: string | null;
  overridingJobPriority: number | null;
  suspended: boolean;
};

async function load(definitionId: string): Promise<JobDef[]> {
  try {
    return await engineGet<JobDef[]>(`/job-definition?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=200`);
  } catch {
    return [];
  }
}

export async function JobDefinitionsTab({ definitionId }: { definitionId: string }) {
  const defs = await load(definitionId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job definitions</CardTitle>
        <CardDescription>Async-after / async-before / timer jobs declared by this definition.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {defs.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No job definitions.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {defs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{d.activityId}</code></TableCell>
                  <TableCell>{d.jobType}</TableCell>
                  <TableCell className="text-xs">{d.jobConfiguration ?? "—"}</TableCell>
                  <TableCell>{d.overridingJobPriority ?? "—"}</TableCell>
                  <TableCell>{d.suspended ? <Badge variant="outline">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <JobPriorityDialog id={d.id} currentPriority={d.overridingJobPriority} />
                    <JobSuspensionButton id={d.id} suspended={d.suspended} />
                    <ExtensionSlot point="cockpit.jobDefinition.action" props={{ jobDefinitionId: d.id }} fallback={null} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cockpit/job-definitions src/app/\(app\)/cockpit/processes/\[key\]/_components/{job-definitions-tab,job-priority-dialog,job-suspension-button}.tsx
git commit -m "feat(cockpit): job-definitions tab + suspend/priority actions"
```

---

## Task 7: Called definitions tab

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/_components/called-definitions-tab.tsx`

- [ ] **Step 1: Tab**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Def = { id: string; key: string; name: string | null; version: number };

async function load(definitionId: string): Promise<Def[]> {
  try {
    return await engineGet<Def[]>(`/process-definition?superProcessDefinitionId=${encodeURIComponent(definitionId)}&maxResults=200`);
  } catch {
    return [];
  }
}

export async function CalledDefinitionsTab({ definitionId }: { definitionId: string }) {
  const defs = await load(definitionId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Called process definitions</CardTitle>
        <CardDescription>Definitions invoked by this one via call activities.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {defs.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">None.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/cockpit/processes/${encodeURIComponent(d.key)}`} className="hover:underline">{d.key}</Link>
                  </TableCell>
                  <TableCell>{d.name ?? "—"}</TableCell>
                  <TableCell>v{d.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/_components/called-definitions-tab.tsx
git commit -m "feat(cockpit): called-definitions tab"
```

---

## Task 8: History instances tab

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/_components/history-instances-tab.tsx`

- [ ] **Step 1: Tab**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";

type HistoricInstance = {
  id: string;
  businessKey: string | null;
  startTime: string;
  endTime: string | null;
  durationInMillis: number | null;
  state: string;
};

async function load(definitionId: string): Promise<HistoricInstance[]> {
  try {
    return await engineGet<HistoricInstance[]>(
      `/history/process-instance?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=200&sortBy=startTime&sortOrder=desc`,
    );
  } catch {
    return [];
  }
}

export async function HistoryInstancesTab({ definitionId }: { definitionId: string }) {
  const list = await load(definitionId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historic instances</CardTitle>
        <CardDescription>{list.length} loaded (newest first).</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No history.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance</TableHead>
                <TableHead>Business key</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-xs">{h.id}</TableCell>
                  <TableCell>{h.businessKey ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(h.startTime).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{h.endTime ? new Date(h.endTime).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    {h.state === "COMPLETED" ? <Badge variant="secondary">Completed</Badge>
                      : h.state === "EXTERNALLY_TERMINATED" ? <Badge variant="outline">Terminated</Badge>
                      : <Badge>{h.state}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/_components/history-instances-tab.tsx
git commit -m "feat(cockpit): history view — historic instances tab"
```

---

## Task 9: Definition-level action menu (suspend / activate)

**Files:**
- Create: `src/app/(app)/cockpit/processes/[key]/_components/definition-actions-menu.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/_components/suspend-definition-dialog.tsx`
- Create: `src/app/api/cockpit/process-definitions/[id]/suspended/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json(); // { suspended: bool, includeProcessInstances: bool, executionDate?: ISO }
  const res = await engineFetch(`/process-definition/${encodeURIComponent(id)}/suspended`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Dialog**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SuspendDefinitionDialog({ id, suspended, open, onOpenChange }: { id: string; suspended: boolean; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [includeInstances, setIncludeInstances] = useState(true);
  const [pending, startTransition] = useTransition();
  const target = !suspended;

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/process-definitions/${encodeURIComponent(id)}/suspended`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: target, includeProcessInstances: includeInstances }),
      });
      if (res.ok) { onOpenChange(false); router.refresh(); }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{target ? "Suspend definition" : "Activate definition"}</DialogTitle></DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeInstances} onCheckedChange={(v) => setIncludeInstances(Boolean(v))} />
          Apply to {target ? "running" : "suspended"} instances too
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={target ? "destructive" : "default"} onClick={submit} disabled={pending}>{pending ? "Working…" : (target ? "Suspend" : "Activate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Menu**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pause, Play } from "lucide-react";
import { SuspendDefinitionDialog } from "./suspend-definition-dialog";

export function DefinitionActionsMenu({ definitionId, definitionKey, suspended }: { definitionId: string; definitionKey: string; suspended: boolean }) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><MoreHorizontal className="mr-1 size-4" /> Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSuspendOpen(true)}>
            {suspended ? <><Play className="mr-2 size-4" />Activate definition</> : <><Pause className="mr-2 size-4" />Suspend definition</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Future: deploy new version, delete deployment — slot here */}
        </DropdownMenuContent>
      </DropdownMenu>
      <SuspendDefinitionDialog id={definitionId} suspended={suspended} open={suspendOpen} onOpenChange={setSuspendOpen} />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cockpit/process-definitions src/app/\(app\)/cockpit/processes/\[key\]/_components/{definition-actions-menu,suspend-definition-dialog}.tsx
git commit -m "feat(cockpit): definition actions menu — suspend/activate"
```

---

## Task 10: cockpit-job-definition plugin

**Files:**
- Create: `plugins/cockpit-job-definition/plugin.json`
- Create: `plugins/cockpit-job-definition/client.tsx`
- Modify: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Manifest**

```json
{
  "id": "cockpit-job-definition",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "cockpit.processDefinition.runtime.tab", "exportName": "JobsTabPanel", "priority": 50 },
      { "point": "cockpit.jobDefinition.action", "exportName": "JobActionMenuItems", "priority": 100 },
      { "point": "cockpit.processDefinition.diagram.overlay", "exportName": "JobSuspensionOverlay", "priority": 100 }
    ]
  }
}
```

- [ ] **Step 2: Client exports**

```tsx
"use client";
import Link from "next/link";

// Tab variant: shows an aggregated "Jobs (running)" view distinct from the built-in Job Definitions tab.
export function JobsTabPanel({ definitionKey, active, view }: { definitionKey: string; active: string; view: string }) {
  if (active !== "jobs") return null;
  if (view !== "runtime") return null;
  return (
    <Link
      href={`/cockpit/processes/${encodeURIComponent(definitionKey)}?tab=jobs&view=${view}`}
      className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      Jobs
    </Link>
  );
}

// Action menu items (rendered into the job-definition row dropdown). For v1 just shows a stub.
export function JobActionMenuItems(_props: { jobDefinitionId: string }) {
  return null; // Real items land in a future port; the slot is wired now for parity.
}

// Diagram overlay (rendered on the BPMN canvas for suspended jobs). v1: empty fallback;
// real overlay logic is a follow-up tracked in plugin issues.
export function JobSuspensionOverlay() {
  return null;
}
```

- [ ] **Step 3: Register in `registry.ts`**

```ts
import jdManifest from "@/../plugins/cockpit-job-definition/plugin.json";
import * as jdClient from "@/../plugins/cockpit-job-definition/client";
PLUGINS.push({ manifest: jdManifest as PluginManifest, clientExports: jdClient as unknown as RegisteredPlugin["clientExports"] });
```

- [ ] **Step 4: Commit**

```bash
git add plugins/cockpit-job-definition src/lib/plugins/registry.ts
git commit -m "feat(plugin): cockpit-job-definition (tab + action + overlay slots)"
```

---

## Task 11: E2E — runtime tabs + history view

**Files:**
- Create: `e2e/cockpit-process-definition.spec.ts`
- Create: `e2e/_fixtures/jobs-timer.bpmn` (if not deployed elsewhere)

- [ ] **Step 1: Fixture**

A BPMN process `JobsTimer` with a timer start event and async-before user task — provides a job-definition row in the runtime tab.

- [ ] **Step 2: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4a process-definition tabs", () => {
  test("renders header + diagram + tab strip and switches tabs", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    await loginAs(page, "demo", "demo");

    await page.goto("/cockpit/processes/TestReview");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Instances" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Incidents" })).toBeVisible();

    await page.getByRole("link", { name: "Incidents" }).click();
    await expect(page).toHaveURL(/tab=incidents/);
    await expect(page.getByRole("heading", { name: /open incidents/i })).toBeVisible();

    await page.getByRole("link", { name: "Job definitions" }).click();
    await expect(page).toHaveURL(/tab=job-definitions/);

    await page.getByRole("link", { name: "Called definitions" }).click();
    await expect(page).toHaveURL(/tab=called-definitions/);

    // History view
    await page.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/view=history/);
    await expect(page.getByRole("heading", { name: /historic instances/i })).toBeVisible();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add e2e/cockpit-process-definition.spec.ts e2e/_fixtures/jobs-timer.bpmn
git commit -m "test(cockpit): @phase-4a tab navigation + history view e2e"
```

---

## Task 12: E2E — definition actions

**Files:**
- Create: `e2e/cockpit-process-definition-actions.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4a definition actions", () => {
  test("suspend then activate", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    await page.goto("/cockpit/processes/TestReview");
    await page.getByRole("button", { name: /actions/i }).click();
    await page.getByRole("menuitem", { name: /suspend definition/i }).click();
    await page.getByRole("button", { name: /^suspend$/i }).click();
    await expect(page.getByText(/suspended/i)).toBeVisible();

    await page.getByRole("button", { name: /actions/i }).click();
    await page.getByRole("menuitem", { name: /activate definition/i }).click();
    await page.getByRole("button", { name: /^activate$/i }).click();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/cockpit-process-definition-actions.spec.ts
git commit -m "test(cockpit): @phase-4a suspend/activate e2e"
```

---

## Task 13: E2E — job-definition plugin slot

**Files:**
- Create: `e2e/cockpit-job-definition-plugin.spec.ts`

- [ ] **Step 1: Spec**

Minimal: asserts the `Jobs` plugin-injected tab link appears on the tab strip. Even though v1 is a stub, the slot wiring is what we want to assert.

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4a plugin slot", () => {
  test("cockpit-job-definition renders Jobs link on tab strip", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    await page.goto("/cockpit/processes/JobsTimer");
    await page.getByRole("link", { name: /^jobs$/i }).click();
    await expect(page).toHaveURL(/tab=jobs/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/cockpit-job-definition-plugin.spec.ts
git commit -m "test(plugin): @phase-4a cockpit-job-definition slot smoke"
```

---

## Task 14: Run @phase-4a + evidence

**Files:** none (DevOps)

- [ ] **Step 1: Run**

DevOps: `npx playwright test --grep @phase-4a --project=chromium,firefox,webkit`.

- [ ] **Step 2: Manual smoke + screenshots**

```
docs/superpowers/specs/evidence/phase-4a/
  ├── list.png
  ├── definition-runtime-instances.png
  ├── definition-runtime-incidents.png
  ├── definition-runtime-job-defs.png
  ├── definition-runtime-called.png
  ├── definition-history.png
  ├── suspend-dialog.png
  └── action-menu.png
```

- [ ] **Step 3: Commit evidence**

```bash
git add docs/superpowers/specs/evidence/phase-4a
git commit -m "docs(phase-4a): manual smoke screenshots"
```

---

## Task 15: Phase 4a exit checklist

**Files:** none

- [ ] **Step 1: Walk relevant §4.4 rows**

Confirm ✅ for: processes-list running count, runtime-tab instances, incidents, job definitions, called definitions, history view, suspend/activate, job priority. Confirm plugin slot wiring for `cockpit-job-definition`.

- [ ] **Step 2: Note dependencies for Phase 4b**

The instance-detail page (`/cockpit/processes/[key]/instances/[id]`) is Phase 4b's surface; this plan does not touch it. Don't flip distro routing yet — that happens after Phase 4d.

- [ ] **Step 3: Final exit commit**

```bash
git commit --allow-empty -m "phase-4a: process-definition surface complete — see roadmap §4.4 partial flip"
```
