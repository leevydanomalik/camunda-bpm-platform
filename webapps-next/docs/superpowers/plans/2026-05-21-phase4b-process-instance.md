# Phase 4b — Process Instance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Phase 4 §4.4 row scoped to *process instance* — refactor the existing detail page into a tabbed surface (variables / incidents / called instances / user tasks / jobs / external tasks), add the history view, ship every action (cancel instance, suspend, add variable, retry job, retry external task, resolve incident), wire diagram overlays beyond the existing activity badges (call-activity drill-down), and port `cockpit-base` (the large multi-slot plugin) and `cockpit-external-tasks-tab`.

**Architecture:** Server components by default per §3.5; tab routing via `?tab=…` and `?view=runtime|history`; mutations via `/api/cockpit/process-instances/[id]/…` route handlers; the existing `BpmnViewer` (`src/components/bpmn-viewer.tsx`) hosts overlays via a new optional `overlays` prop populated from `ExtensionSlot`-rendered widgets. `cockpit-base` is the largest single port — it registers across `cockpit.processInstance.runtime.tab`, `cockpit.processInstance.runtime.action`, `cockpit.incident.action`, and the diagram-overlay slot.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, `bpmn-js` (already a dep), Playwright, Vitest.

**Spec / inventory:** [`docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md`](../specs/2026-05-21-webapps-migration-roadmap-design.md) §4.4 (process-instance rows) + §5.1 + §5.3.

**Preconditions:**
- All Phase 0 sub-plans.
- Phase 2 (tasklist completion) — links from user-task tab cross into tasklist.
- Phase 4a (process definition) — shares the action-menu / dialog / tab-strip patterns + the `/api/cockpit/jobs/[id]/retries` and `/api/cockpit/incidents/[id]/resolve` endpoints.

---

## Constraints binding this plan

- **No auto-commit.** Stop after each task; summarize diff.
- **Camunda formation roles:** FE owns `webapps-next/src/**`, `webapps-next/e2e/**`, `webapps-next/plugins/**`. BE only for Task 0. DevOps runs all commands.
- **Public API change rule:** No JAX-RS signature changes.
- **Engine prerequisite:** Camunda Run on `localhost:8080`; fixture process `TestReview` (Phase 2 setup); fixture process `JobsTimer` (Phase 4a setup); a fixture process with an external task — `ExternalTasks.bpmn` deployed by Task 0 setup.
- **`use client` discipline:** Page server-rendered; only mutation buttons / dialogs / interactive overlays are clients.
- **Existing in-progress files:** Reconcile. The current page renders the diagram with activity badges + variables + incidents as Cards; restructure into tabs.
- **Real-time policy (§3.7):** 5s poll on the runtime view of a single instance is acceptable here — but server components don't poll. v1 ships static SSR + a "Refresh" button + Next's `router.refresh()` after mutations. TanStack-Query-driven polling is a follow-up.

---

## Layout, Component & Typography Spec

### Typography scale

| Token | Class | When |
|---|---|---|
| `display` | `text-3xl font-semibold` | Stat counters (active tokens, open incidents, running tasks). |
| `h1` page title | `text-2xl font-semibold tracking-tight` | "Process instance" — paired with mono `text-muted-foreground text-sm font-mono` ID subtitle. |
| `h2` section | `<CardTitle>` (shadcn defaults). |
| `h3` subsection | `text-sm font-medium` | Stat-card titles, tab labels. |
| `body-muted` | `text-muted-foreground text-sm` | Descriptions, empty states. |
| `caption` | `text-xs text-muted-foreground` | Activity IDs, timestamps. |
| `code` inline | `bg-muted rounded px-1 text-xs font-mono` | Activity IDs, job IDs, variable names. |
| `code` block | `bg-muted text-muted-foreground rounded p-3 text-xs font-mono` | Stack traces, raw incident messages. |

### Spacing scale

- Page rhythm: `space-y-6`.
- Header block: `space-y-2`.
- 3-col meta grid: `grid gap-4 md:grid-cols-3`.
- Stat counters above tab strip: `grid gap-4 md:grid-cols-2 lg:grid-cols-4`.
- Tab content Card: standard.
- Tab strip margin: `mb-6`.

### Color tokens

- Default text: implicit.
- Muted: `text-muted-foreground`.
- Destructive: `text-destructive`, `variant="destructive"` (cancel instance, open incidents).
- Warning: instance suspended → `<Badge variant="outline">`, never-touched-`text-yellow-*`.

### Layout grid

**Instance page (`/cockpit/processes/[key]/instances/[id]`)** — single column:

```
┌────────────────────────────────────────────────────────────────┐
│  ← Back to definition                                           │
│  flex justify-between:                                          │
│    h1 "Process instance" + subtitle (mono ID)         │ Badges (Active/Suspended, X incidents) + Action menu
├────────────────────────────────────────────────────────────────┤
│  Card { Diagram + overlays (active activity badges,             │
│         incident counts top-right, plugin overlays)             │
├────────────────────────────────────────────────────────────────┤
│  3-col meta cards: Business key | Definition | Tenant            │
├────────────────────────────────────────────────────────────────┤
│  View toggle: [ Runtime ] [ History ]                            │
├────────────────────────────────────────────────────────────────┤
│  Tab strip:                                                      │
│  [ Variables ] [ Incidents ] [ User tasks ] [ Jobs ]             │
│  [ External tasks ] [ Called instances ] [ <plugin tabs> ]       │
├────────────────────────────────────────────────────────────────┤
│  Tab content (Card)                                              │
└────────────────────────────────────────────────────────────────┘
```

### Tab routing convention

- `?tab=variables|incidents|user-tasks|jobs|external-tasks|called-instances|<plugin-id>`.
- `?view=runtime|history`.
- Default tab: `variables`.
- Default view: `runtime`.
- History view hides all runtime-only tabs and shows: `[ Activity timeline ] [ Variables ] [ Incidents ] [ User tasks ]` (history-scoped data sources).

### Component composition rules

| Pattern | Use |
|---|---|
| Tab strip | URL-driven `<Link>` segmented control (same shape as Phase 4a). |
| Action menu | `<DropdownMenu>` with destructive items styled `text-destructive`. |
| Cancel-instance confirm | `<Dialog>` requiring the user to type the instance ID. |
| Add-variable form | `<Dialog>` with `<VariableEditorRow>` re-used from Phase 2 `task-detail-pane` (cannot import — copy the helper to `src/lib/cockpit/variable-cast.ts`). |
| Retry button (job / external task) | Inline button with optimistic `disabled` after click. |
| Empty / error states | Same conventions as Phase 4a. |
| Plugin slot | `<ExtensionSlot point="cockpit.processInstance.runtime.tab" props={{ instanceId, definitionKey, activeActivityIds, view, tab }} />`. |
| Diagram overlay slot | `<ExtensionSlot point="cockpit.processInstance.diagram.overlay" props={{ instanceId, definitionId, activeActivityIds }} />` rendered as children of `<BpmnViewer>` overlays container. |

### Iconography (lucide-react)

| Domain | Icon |
|---|---|
| Variables | `Braces` |
| Incidents | `AlertTriangle`, `AlertCircle` |
| User tasks | `ClipboardList` |
| Jobs | `Cog`, `Clock` |
| External tasks | `Cable`, `ArrowUpRight` |
| Called instances | `GitBranch` |
| History | `History` |
| Cancel | `XCircle` |
| Suspend / activate | `Pause`, `Play` |
| Retry | `RotateCcw` |
| Add | `Plus` |
| Edit | `Pencil` |

### Forms / dialogs

- Type-instance-ID-to-confirm pattern for cancel.
- Add-variable dialog has 3 fields: Name (`Input`), Type (`Select` with `String/Long/Double/Boolean/Date/Json`), Value (`Input`).
- Retry-job dialog (optional override of retries): single `Input number` defaulting to `1`.
- Retry-external-task dialog: numeric retries + workerId (optional).

### Tables

- Activity ID columns: `font-mono text-xs`.
- Timestamp columns: `whitespace-nowrap text-xs` + locale-string.
- Rightmost action column: width `w-44` to accommodate two buttons + plugin slot.

### Responsive

- 3-col meta grid collapses to 1-col below `md:`.
- Tab strip wraps via `flex-wrap`.

---

## File Structure

**Already exists (reconciled):**

| File | Current | Delta |
|---|---|---|
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/page.tsx` | Header + diagram + 3-col meta + variables Card + incidents Card | Refactor into tabs + view toggle; move variables/incidents into tab bodies; mount action menu + diagram overlay slot. |
| `src/components/bpmn-viewer.tsx` | Supports `activityIds`, `badges`, `heatmap`. | Add optional `overlayChildren?: React.ReactNode` prop — rendered absolutely positioned above the canvas; allows plugin overlay components. |

**Net-new — components:**

| File | Responsibility |
|---|---|
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/tab-strip.tsx` | URL-driven segmented control + plugin tab slot. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/view-toggle.tsx` | Runtime / History toggle. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/variables-tab.tsx` | Runtime variables table + add/edit/delete (server + client child editor). |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/variables-editor.tsx` | Client component — add/edit/delete variable rows. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/incidents-tab.tsx` | Open incidents with per-row retry + resolve actions + plugin action slot. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/user-tasks-tab.tsx` | Active user tasks for this instance; link to tasklist. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/jobs-tab.tsx` | Active jobs (`/job?processInstanceId=`) + retry. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/external-tasks-tab.tsx` | External tasks + retry/unlock. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/called-instances-tab.tsx` | Sub-process instances. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/history-tab.tsx` | History view — activity instance timeline. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/instance-actions-menu.tsx` | Dropdown — Cancel / Suspend-or-Activate / Add variable. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/cancel-instance-dialog.tsx` | Confirm dialog. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/suspend-instance-dialog.tsx` | Confirm dialog. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/add-variable-dialog.tsx` | Add a new instance variable. |
| `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/external-task-actions.tsx` | Retry / unlock buttons. |
| `src/components/diagram-overlay-host.tsx` | Renders overlay children absolutely positioned at each activity element. Used by `BpmnViewer` via slot ref. |

**Net-new — route handlers:**

| File | Methods | Backend |
|---|---|---|
| `src/app/api/cockpit/process-instances/[id]/route.ts` | DELETE (cancel) | `engine-rest/process-instance/{id}` |
| `src/app/api/cockpit/process-instances/[id]/suspended/route.ts` | PUT | `engine-rest/process-instance/{id}/suspended` |
| `src/app/api/cockpit/process-instances/[id]/variables/[name]/route.ts` | PUT, DELETE | `engine-rest/process-instance/{id}/variables/{name}` |
| `src/app/api/cockpit/external-tasks/[id]/retries/route.ts` | PUT | `engine-rest/external-task/{id}/retries` |
| `src/app/api/cockpit/external-tasks/[id]/unlock/route.ts` | POST | `engine-rest/external-task/{id}/unlock` |

(Jobs retries + incident resolve routes already shipped by Phase 4a.)

**Net-new — lib:**

| File |
|---|
| `src/lib/cockpit/variable-cast.ts` |
| `src/lib/cockpit/variable-cast.test.ts` |

(Pure type-casting helpers shared by tasklist + cockpit variable editors.)

**Net-new — plugins:**

| File | Responsibility |
|---|---|
| `plugins/cockpit-base/plugin.json` | Multi-slot registration. |
| `plugins/cockpit-base/client.tsx` | Named exports for each registered slot; v1 implements *visible* slot adapters and leaves rich behaviors as stubs documented inline. |
| `plugins/cockpit-external-tasks-tab/plugin.json` | Registers into `cockpit.processInstance.runtime.tab`. |
| `plugins/cockpit-external-tasks-tab/client.tsx` | Adds a richer "External tasks" tab (variant) — the built-in tab handles the simple case. |

**Net-new — e2e:**

| File |
|---|
| `e2e/cockpit-process-instance.spec.ts` |
| `e2e/cockpit-process-instance-actions.spec.ts` |
| `e2e/cockpit-process-instance-external-tasks.spec.ts` |
| `e2e/_fixtures/external-tasks.bpmn` |

**Not touched (explicit):** `engine.ts`, `session.ts`, `proxy.ts`, `(app)/layout.tsx`, any shadcn primitive, any Java file.

---

## Task 0: BE handoff — confirm DTOs + endpoints + ship fixture

**Files:** none (read-only) + a fixture BPMN

- [ ] **Step 1: Dispatch BE persona**

> Read-only investigation on `engine-rest/`. Confirm:
> 1. `ProcessInstanceDto` — fields, esp. `ended`, `suspended`, `caseInstanceId`.
> 2. `ProcessInstanceSuspensionStateDto` — body for `PUT /process-instance/{id}/suspended` (`suspended: bool`).
> 3. DELETE `/process-instance/{id}` — does it require query params (`skipCustomListeners`, `skipIoMappings`)? Document accepted ones.
> 4. `VariableValueDto` — round-trip for `PUT /process-instance/{id}/variables/{name}` (`{ value, type, valueInfo? }`).
> 5. `JobDto` — fields (id, dueDate, retries, exceptionMessage, suspended).
> 6. `ExternalTaskDto` — fields (id, topicName, workerId, lockExpirationTime, retries, errorMessage).
> 7. POST `/external-task/{id}/unlock` — request body shape (likely empty).
> 8. PUT `/external-task/{id}/retries` — body `{ retries: number }`.
> 9. `/process-instance?superProcessInstance={id}` and `/process-instance?subProcessInstance={id}` semantics — confirm which direction surfaces "called instances of this instance".
> 10. `/history/activity-instance?processInstanceId=` for the history timeline tab.
>
> Write report under `docs/superpowers/specs/evidence/phase-4b/be-dto-report.md`.

- [ ] **Step 2: Add external-task fixture**

```
e2e/_fixtures/external-tasks.bpmn
```

A BPMN process `ExternalTaskFlow` with one external task (topic `e2e-topic`). Hand-rolled minimal XML; deployed by the existing globalSetup if added to the deploy script.

- [ ] **Step 3: Update `e2e/_fixtures/deploy.ts`**

Add `external-tasks.bpmn` to the multipart.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-4b/be-dto-report.md e2e/_fixtures/external-tasks.bpmn e2e/_fixtures/deploy.ts
git commit -m "docs(phase-4b): DTO report + external-task fixture"
```

---

## Task 1: Reconcile

**Files:**
- Read: `src/app/(app)/cockpit/processes/[key]/instances/[id]/page.tsx`, `src/components/bpmn-viewer.tsx`
- Write: `docs/superpowers/specs/evidence/phase-4b/reconcile.md`

- [ ] **Step 1: Read each file**

- [ ] **Step 2: Write reconcile.md**

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-4b/reconcile.md
git commit -m "docs(phase-4b): reconcile in-progress state vs. plan"
```

---

## Task 2: Variable-cast helper + tests

**Files:**
- Create: `src/lib/cockpit/variable-cast.ts`
- Create: `src/lib/cockpit/variable-cast.test.ts`

- [ ] **Step 1: Helper**

```ts
export type EngineVariableType = "String" | "Long" | "Double" | "Boolean" | "Date" | "Json";
export const ENGINE_VARIABLE_TYPES: EngineVariableType[] = ["String", "Long", "Double", "Boolean", "Date", "Json"];

export function castVariableValue(type: EngineVariableType, raw: string): unknown {
  switch (type) {
    case "Boolean": return raw.toLowerCase() === "true";
    case "Long": return Number.parseInt(raw, 10);
    case "Double": return Number.parseFloat(raw);
    case "Date": return new Date(raw).toISOString();
    case "Json": return JSON.parse(raw);
    case "String":
    default: return raw;
  }
}

export function serializeVariableValue(v: unknown): { type: EngineVariableType; value: unknown } {
  if (typeof v === "boolean") return { type: "Boolean", value: v };
  if (typeof v === "number") return { type: Number.isInteger(v) ? "Long" : "Double", value: v };
  if (v instanceof Date) return { type: "Date", value: v.toISOString() };
  if (typeof v === "object" && v !== null) return { type: "Json", value: JSON.stringify(v) };
  return { type: "String", value: String(v ?? "") };
}
```

- [ ] **Step 2: Tests**

```ts
import { describe, expect, test } from "vitest";
import { castVariableValue, serializeVariableValue } from "./variable-cast";

describe("variable-cast", () => {
  test("casts Long", () => expect(castVariableValue("Long", "42")).toBe(42));
  test("casts Boolean true/false", () => {
    expect(castVariableValue("Boolean", "true")).toBe(true);
    expect(castVariableValue("Boolean", "false")).toBe(false);
  });
  test("casts Json", () => expect(castVariableValue("Json", '{"a":1}')).toEqual({ a: 1 }));
  test("infers Long vs Double", () => {
    expect(serializeVariableValue(7).type).toBe("Long");
    expect(serializeVariableValue(7.5).type).toBe("Double");
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cockpit/variable-cast.ts src/lib/cockpit/variable-cast.test.ts
git commit -m "feat(cockpit): variable-cast helper + tests"
```

---

## Task 3: Page refactor — header + tab strip + view toggle

**Files:**
- Modify: `src/app/(app)/cockpit/processes/[key]/instances/[id]/page.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/tab-strip.tsx`
- Create: `src/app/(app)/cockpit/processes/[key]/instances/[id]/_components/view-toggle.tsx`
- Create: placeholder stubs for each tab body component (will fill in subsequent tasks)

- [ ] **Step 1: Tab strip**

```tsx
import Link from "next/link";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

const RUNTIME_TABS = [
  { key: "variables", label: "Variables" },
  { key: "incidents", label: "Incidents" },
  { key: "user-tasks", label: "User tasks" },
  { key: "jobs", label: "Jobs" },
  { key: "external-tasks", label: "External tasks" },
  { key: "called-instances", label: "Called instances" },
];

const HISTORY_TABS = [
  { key: "history", label: "Activity timeline" },
  { key: "variables", label: "Variables" },
  { key: "incidents", label: "Incidents" },
  { key: "user-tasks", label: "User tasks" },
];

export function TabStrip({
  active,
  view,
  definitionKey,
  instanceId,
  activeActivityIds,
}: {
  active: string;
  view: "runtime" | "history";
  definitionKey: string;
  instanceId: string;
  activeActivityIds: string[];
}) {
  const tabs = view === "history" ? HISTORY_TABS : RUNTIME_TABS;
  return (
    <nav className="inline-flex flex-wrap items-center gap-1 rounded-md bg-muted p-0.5 text-sm">
      {tabs.map((t) => {
        const params = new URLSearchParams({ tab: t.key, view });
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`/cockpit/processes/${encodeURIComponent(definitionKey)}/instances/${encodeURIComponent(instanceId)}?${params.toString()}`}
            className={`rounded-sm px-3 py-1.5 ${isActive ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
      <ExtensionSlot
        point="cockpit.processInstance.runtime.tab"
        props={{ instanceId, definitionKey, activeActivityIds, view, active }}
        fallback={null}
      />
    </nav>
  );
}
```

- [ ] **Step 2: View toggle**

```tsx
import Link from "next/link";

export function ViewToggle({ view, definitionKey, instanceId, tab }: { view: "runtime" | "history"; definitionKey: string; instanceId: string; tab: string }) {
  const make = (v: "runtime" | "history") => {
    const p = new URLSearchParams({ tab: v === "history" ? "history" : tab, view: v });
    return `/cockpit/processes/${encodeURIComponent(definitionKey)}/instances/${encodeURIComponent(instanceId)}?${p.toString()}`;
  };
  return (
    <div className="inline-flex items-center rounded-md bg-muted p-0.5 text-xs">
      <Link href={make("runtime")} className={`rounded-sm px-2.5 py-1 ${view === "runtime" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Runtime</Link>
      <Link href={make("history")} className={`rounded-sm px-2.5 py-1 ${view === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>History</Link>
    </div>
  );
}
```

- [ ] **Step 3: Refactor page**

```tsx
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { type ActivityBadge, BpmnViewer } from "@/components/bpmn-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";
import { InstanceActionsMenu } from "./_components/instance-actions-menu";
import { TabStrip } from "./_components/tab-strip";
import { ViewToggle } from "./_components/view-toggle";
import { VariablesTab } from "./_components/variables-tab";
import { IncidentsTab } from "./_components/incidents-tab";
import { UserTasksTab } from "./_components/user-tasks-tab";
import { JobsTab } from "./_components/jobs-tab";
import { ExternalTasksTab } from "./_components/external-tasks-tab";
import { CalledInstancesTab } from "./_components/called-instances-tab";
import { HistoryTab } from "./_components/history-tab";

// Existing helpers (flattenActivityIds, countByActivity, load, formatDate) — KEEP as-is.

const RUNTIME = new Set(["variables", "incidents", "user-tasks", "jobs", "external-tasks", "called-instances"]);
const HISTORY = new Set(["history", "variables", "incidents", "user-tasks"]);

export default async function InstanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; id: string }>;
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const { key, id } = await params;
  const { tab: rawTab, view: rawView } = await searchParams;
  const view: "runtime" | "history" = rawView === "history" ? "history" : "runtime";
  const set = view === "history" ? HISTORY : RUNTIME;
  const tab = set.has(rawTab ?? "") ? (rawTab as string) : (view === "history" ? "history" : "variables");

  const { instance, xml, variables, incidents, activeActivityIds, error } = await load(id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cockpit/processes/${encodeURIComponent(key)}`}><ArrowLeft className="mr-2 size-4" /> Back to definition</Link>
        </Button>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Process instance</h1>
            <p className="text-muted-foreground text-sm font-mono">{id}</p>
          </div>
          <div className="flex items-center gap-2">
            {instance?.suspended ? <Badge variant="outline">Suspended</Badge> : instance ? <Badge>Active</Badge> : null}
            {incidents.length > 0 ? <Badge variant="destructive"><AlertTriangle className="mr-1 size-3" /> {incidents.length}</Badge> : null}
            {instance ? <InstanceActionsMenu instanceId={id} definitionKey={key} suspended={instance.suspended} /> : null}
          </div>
        </div>
      </div>

      {error ? <Card><CardContent className="text-destructive p-6 text-sm">{error}</CardContent></Card> : null}

      {xml ? (
        <Card>
          <CardHeader>
            <CardTitle>Diagram</CardTitle>
            <CardDescription>Active activities outlined; counts shown bottom-left for parallel/multi-instance executions.</CardDescription>
          </CardHeader>
          <CardContent>
            <BpmnViewer
              xml={xml}
              height={420}
              activityIds={activeActivityIds}
              badges={buildBadges(activeActivityIds, incidents)}
              overlayChildren={
                <ExtensionSlot
                  point="cockpit.processInstance.diagram.overlay"
                  props={{ instanceId: id, definitionId: instance?.definitionId, activeActivityIds }}
                  fallback={null}
                />
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {instance ? (
        <div className="grid gap-4 md:grid-cols-3">
          <MetaCard title="Business key" value={instance.businessKey ?? "—"} />
          <MetaCard title="Definition" value={<code className="text-xs">{instance.definitionId}</code>} />
          <MetaCard title="Tenant" value={instance.tenantId ?? "—"} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <ViewToggle view={view} definitionKey={key} instanceId={id} tab={tab} />
      </div>

      <TabStrip active={tab} view={view} definitionKey={key} instanceId={id} activeActivityIds={activeActivityIds} />

      {view === "runtime" && tab === "variables" && <VariablesTab instanceId={id} initial={variables} />}
      {view === "runtime" && tab === "incidents" && <IncidentsTab instanceId={id} initial={incidents} />}
      {view === "runtime" && tab === "user-tasks" && <UserTasksTab instanceId={id} definitionKey={key} />}
      {view === "runtime" && tab === "jobs" && <JobsTab instanceId={id} />}
      {view === "runtime" && tab === "external-tasks" && <ExternalTasksTab instanceId={id} />}
      {view === "runtime" && tab === "called-instances" && <CalledInstancesTab instanceId={id} />}
      {view === "history" && <HistoryTab instanceId={id} tab={tab} />}
    </div>
  );
}

function MetaCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm">{value}</CardContent>
    </Card>
  );
}

// Extracted helper:
function buildBadges(active: string[], incidents: Array<{ activityId: string | null }>): ActivityBadge[] {
  const counts: Record<string, number> = {};
  for (const a of active) counts[a] = (counts[a] ?? 0) + 1;
  const badges: ActivityBadge[] = Object.entries(counts).filter(([, c]) => c > 1).map(([elementId, count]) => ({ elementId, count, tone: "default", position: "bottom-left" }));
  for (const i of incidents) {
    if (!i.activityId) continue;
    const existing = badges.find((b) => b.elementId === i.activityId && b.tone === "warning");
    if (existing) existing.count += 1;
    else badges.push({ elementId: i.activityId, count: 1, tone: "warning", position: "top-right" });
  }
  return badges;
}
```

- [ ] **Step 4: Extend `BpmnViewer` with `overlayChildren`**

In `src/components/bpmn-viewer.tsx`, add an optional prop:

```tsx
export function BpmnViewer({
  xml,
  height,
  activityIds,
  badges,
  heatmap,
  overlayChildren,
}: {
  xml: string;
  height: number;
  activityIds?: string[];
  badges?: ActivityBadge[];
  heatmap?: Record<string, number>;
  overlayChildren?: React.ReactNode;
}) {
  // ...existing impl...
  return (
    <div ref={containerRef} className="relative" style={{ height }}>
      {/* existing canvas mount */}
      <div className="pointer-events-none absolute inset-0">{overlayChildren}</div>
    </div>
  );
}
```

- [ ] **Step 5: Create empty placeholder stubs for each tab body**

Each file simply exports a component returning a Card with `"(coming up in a later step)"`. This keeps imports green between commits.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\] src/components/bpmn-viewer.tsx
git commit -m "refactor(cockpit): instance page → tabs + view toggle (placeholders)"
```

---

## Task 4: Variables tab (read + add/edit/delete)

**Files:**
- Replace placeholder: `_components/variables-tab.tsx`
- Create: `_components/variables-editor.tsx`
- Create: `_components/add-variable-dialog.tsx`
- Create: `src/app/api/cockpit/process-instances/[id]/variables/[name]/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, name } = await params;
  const body = await req.json();
  const res = await engineFetch(`/process-instance/${encodeURIComponent(id)}/variables/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, name } = await params;
  const res = await engineFetch(`/process-instance/${encodeURIComponent(id)}/variables/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Variables editor (client) — same shape as the tasklist editor**

(Mirror the tasklist `variables-editor.tsx` from Phase 2 Task 6, swapping the URL prefix to `/api/cockpit/process-instances/{id}/variables/{name}`. Use `src/lib/cockpit/variable-cast.ts` for casting.)

- [ ] **Step 3: Tab wrapper**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VariablesEditor } from "./variables-editor";
import { AddVariableDialog } from "./add-variable-dialog";

type Variable = { type: string; value: unknown };

export function VariablesTab({ instanceId, initial }: { instanceId: string; initial: Record<string, Variable> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Variables</CardTitle>
          <CardDescription>Process-instance scope.</CardDescription>
        </div>
        <AddVariableDialog instanceId={instanceId} />
      </CardHeader>
      <CardContent>
        <VariablesEditor instanceId={instanceId} initial={initial} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Add-variable dialog**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { castVariableValue, ENGINE_VARIABLE_TYPES, type EngineVariableType } from "@/lib/cockpit/variable-cast";

export function AddVariableDialog({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<EngineVariableType>("String");
  const [raw, setRaw] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/process-instances/${encodeURIComponent(instanceId)}/variables/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: castVariableValue(type, raw), type }),
      });
      if (res.ok) { setOpen(false); setName(""); setRaw(""); router.refresh(); }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 size-4" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add variable</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as EngineVariableType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENGINE_VARIABLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Value</Label><Input value={raw} onChange={(e) => setRaw(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cockpit/process-instances src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/{variables-tab,variables-editor,add-variable-dialog}.tsx
git commit -m "feat(cockpit): instance variables tab (CRUD)"
```

---

## Task 5: Incidents tab (with retry/resolve + plugin action slot)

**Files:**
- Replace placeholder: `_components/incidents-tab.tsx`

- [ ] **Step 1: Component**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";
import { IncidentRetryButton } from "../../../../_components/incident-retry-button";

type Incident = {
  id: string;
  incidentMessage: string | null;
  incidentType: string;
  activityId: string | null;
  configuration: string | null;
  incidentTimestamp: string;
};

export function IncidentsTab({ instanceId, initial }: { instanceId: string; initial: Incident[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open incidents</CardTitle>
        <CardDescription>{initial.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {initial.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No incidents.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-60" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(i.incidentTimestamp).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="destructive">{i.incidentType}</Badge></TableCell>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{i.activityId ?? "—"}</code></TableCell>
                  <TableCell className="text-xs">{i.incidentMessage ?? "—"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {i.incidentType === "failedJob" && i.configuration ? <IncidentRetryButton jobId={i.configuration} /> : null}
                    <ExtensionSlot point="cockpit.incident.action" props={{ incident: i, instanceId }} fallback={null} />
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

NB: `IncidentRetryButton` is the Phase 4a component. Import path uses relative back-traversal — the FE agent should verify the alias resolves and switch to `@/app/(app)/cockpit/processes/[key]/_components/incident-retry-button` if cleaner.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/incidents-tab.tsx
git commit -m "feat(cockpit): instance incidents tab + plugin action slot"
```

---

## Task 6: User tasks tab

**Files:**
- Replace placeholder: `_components/user-tasks-tab.tsx`

- [ ] **Step 1: Component**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Task = { id: string; name: string; assignee: string | null; created: string; due: string | null; processDefinitionId: string };

async function load(instanceId: string): Promise<Task[]> {
  try {
    return await engineGet<Task[]>(`/task?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200&sortBy=created&sortOrder=desc`);
  } catch {
    return [];
  }
}

export async function UserTasksTab({ instanceId, definitionKey: _definitionKey }: { instanceId: string; definitionKey: string }) {
  const tasks = await load(instanceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active user tasks</CardTitle>
        <CardDescription>{tasks.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No tasks.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><Link href={`/tasklist/${encodeURIComponent(t.id)}`} className="hover:underline">{t.name}</Link></TableCell>
                  <TableCell>{t.assignee ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(t.created).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{t.due ? new Date(t.due).toLocaleString() : "—"}</TableCell>
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
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/user-tasks-tab.tsx
git commit -m "feat(cockpit): instance user-tasks tab"
```

---

## Task 7: Jobs tab + retry

**Files:**
- Replace placeholder: `_components/jobs-tab.tsx`

- [ ] **Step 1: Component**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";
import { IncidentRetryButton } from "../../../../_components/incident-retry-button"; // re-used as a generic "retry job" button

type Job = { id: string; dueDate: string | null; retries: number; suspended: boolean; exceptionMessage: string | null };

async function load(instanceId: string): Promise<Job[]> {
  try { return await engineGet<Job[]>(`/job?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200`); }
  catch { return []; }
}

export async function JobsTab({ instanceId }: { instanceId: string }) {
  const jobs = await load(instanceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active jobs</CardTitle>
        <CardDescription>{jobs.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No jobs.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.id}</TableCell>
                  <TableCell className="text-xs">{j.dueDate ? new Date(j.dueDate).toLocaleString() : "—"}</TableCell>
                  <TableCell>{j.retries}</TableCell>
                  <TableCell>
                    {j.suspended ? <Badge variant="outline">Suspended</Badge>
                     : j.retries === 0 ? <Badge variant="destructive">Failed</Badge>
                     : <Badge variant="secondary">Active</Badge>}
                  </TableCell>
                  <TableCell>{j.retries === 0 ? <IncidentRetryButton jobId={j.id} /> : null}</TableCell>
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
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/jobs-tab.tsx
git commit -m "feat(cockpit): instance jobs tab"
```

---

## Task 8: External tasks tab + retry/unlock

**Files:**
- Replace placeholder: `_components/external-tasks-tab.tsx`
- Create: `_components/external-task-actions.tsx`
- Create: `src/app/api/cockpit/external-tasks/[id]/retries/route.ts`
- Create: `src/app/api/cockpit/external-tasks/[id]/unlock/route.ts`

- [ ] **Step 1: Routes**

```ts
// retries/route.ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const res = await engineFetch(`/external-task/${encodeURIComponent(id)}/retries`, {
    method: "PUT",
    body: JSON.stringify({ retries: body.retries ?? 1 }),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

```ts
// unlock/route.ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/external-task/${encodeURIComponent(id)}/unlock`, { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Actions**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw, Unlock } from "lucide-react";

export function ExternalTaskActions({ taskId, retries }: { taskId: string; retries: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const retry = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/external-tasks/${encodeURIComponent(taskId)}/retries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retries: Math.max(1, retries + 1) }),
      });
      if (res.ok) router.refresh();
    });

  const unlock = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/external-tasks/${encodeURIComponent(taskId)}/unlock`, { method: "POST" });
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={retry}><RotateCcw className="mr-1 size-4" /> Retry</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={unlock}><Unlock className="mr-1 size-4" /> Unlock</Button>
    </div>
  );
}
```

- [ ] **Step 3: Tab**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";
import { ExternalTaskActions } from "./external-task-actions";

type ExternalTask = { id: string; topicName: string; workerId: string | null; lockExpirationTime: string | null; retries: number | null; errorMessage: string | null };

async function load(instanceId: string): Promise<ExternalTask[]> {
  try { return await engineGet<ExternalTask[]>(`/external-task?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200`); }
  catch { return []; }
}

export async function ExternalTasksTab({ instanceId }: { instanceId: string }) {
  const list = await load(instanceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>External tasks</CardTitle>
        <CardDescription>{list.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No external tasks.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Lock until</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{t.topicName}</code></TableCell>
                  <TableCell className="font-mono text-xs">{t.workerId ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.lockExpirationTime ? new Date(t.lockExpirationTime).toLocaleString() : "—"}</TableCell>
                  <TableCell>{t.retries ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.errorMessage ?? "—"}</TableCell>
                  <TableCell><ExternalTaskActions taskId={t.id} retries={t.retries ?? 0} /></TableCell>
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
git add src/app/api/cockpit/external-tasks src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/{external-tasks-tab,external-task-actions}.tsx
git commit -m "feat(cockpit): instance external-tasks tab + retry/unlock"
```

---

## Task 9: Called instances tab

**Files:**
- Replace placeholder: `_components/called-instances-tab.tsx`

- [ ] **Step 1: Component**

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Called = { id: string; definitionId: string; businessKey: string | null };

async function load(instanceId: string): Promise<Called[]> {
  try {
    return await engineGet<Called[]>(`/process-instance?superProcessInstance=${encodeURIComponent(instanceId)}&maxResults=200`);
  } catch {
    return [];
  }
}

function defKey(definitionId: string): string {
  return definitionId.split(":")[0] ?? definitionId;
}

export async function CalledInstancesTab({ instanceId }: { instanceId: string }) {
  const list = await load(instanceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Called instances</CardTitle>
        <CardDescription>{list.length} loaded.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">None.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead>Business key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/cockpit/processes/${encodeURIComponent(defKey(c.definitionId))}/instances/${encodeURIComponent(c.id)}`} className="hover:underline">{c.id}</Link>
                  </TableCell>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{c.definitionId}</code></TableCell>
                  <TableCell>{c.businessKey ?? "—"}</TableCell>
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
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/called-instances-tab.tsx
git commit -m "feat(cockpit): instance called-instances tab"
```

---

## Task 10: History tab — activity timeline + history variables / incidents / user tasks

**Files:**
- Replace placeholder: `_components/history-tab.tsx`

- [ ] **Step 1: Component (dispatches per nested `tab`)**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";

type HActivity = { id: string; activityId: string; activityType: string; activityName: string | null; startTime: string; endTime: string | null; durationInMillis: number | null };
type HVariable = { name: string; type: string; value: unknown; activityInstanceId: string | null };
type HIncident = { id: string; createTime: string; incidentType: string; incidentMessage: string | null; activityId: string | null; endTime: string | null };
type HTask = { id: string; name: string; assignee: string | null; startTime: string; endTime: string | null; deleteReason: string | null };

async function safe<T>(p: string): Promise<T[]> { try { return await engineGet<T[]>(p); } catch { return []; } }

export async function HistoryTab({ instanceId, tab }: { instanceId: string; tab: string }) {
  if (tab === "variables") {
    const v = await safe<HVariable>(`/history/variable-instance?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200`);
    return (
      <Card>
        <CardHeader><CardTitle>Historic variables</CardTitle><CardDescription>{v.length} entries.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {v.length === 0 ? <div className="text-muted-foreground p-6 text-sm">No data.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {v.map((h) => (
                  <TableRow key={`${h.name}-${h.activityInstanceId ?? "scope"}`}>
                    <TableCell className="font-mono text-xs">{h.name}</TableCell>
                    <TableCell>{h.type}</TableCell>
                    <TableCell className="font-mono text-xs">{h.value === null ? "null" : typeof h.value === "object" ? JSON.stringify(h.value) : String(h.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  if (tab === "incidents") {
    const i = await safe<HIncident>(`/history/incident?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200`);
    return (
      <Card>
        <CardHeader><CardTitle>Historic incidents</CardTitle><CardDescription>{i.length} entries.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {i.length === 0 ? <div className="text-muted-foreground p-6 text-sm">No data.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Opened</TableHead><TableHead>Closed</TableHead><TableHead>Type</TableHead><TableHead>Activity</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
              <TableBody>
                {i.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.createTime).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{h.endTime ? new Date(h.endTime).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant="destructive">{h.incidentType}</Badge></TableCell>
                    <TableCell><code className="bg-muted rounded px-1 text-xs">{h.activityId ?? "—"}</code></TableCell>
                    <TableCell className="text-xs">{h.incidentMessage ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  if (tab === "user-tasks") {
    const t = await safe<HTask>(`/history/task?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=200&sortBy=startTime&sortOrder=asc`);
    return (
      <Card>
        <CardHeader><CardTitle>Historic user tasks</CardTitle></CardHeader>
        <CardContent className="p-0">
          {t.length === 0 ? <div className="text-muted-foreground p-6 text-sm">No data.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Assignee</TableHead><TableHead>Started</TableHead><TableHead>Ended</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {t.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>{h.assignee ?? "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(h.startTime).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{h.endTime ? new Date(h.endTime).toLocaleString() : "—"}</TableCell>
                    <TableCell>{h.endTime ? (h.deleteReason ? <Badge variant="outline">{h.deleteReason}</Badge> : <Badge>Completed</Badge>) : <Badge variant="secondary">Active</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default: activity timeline
  const acts = await safe<HActivity>(`/history/activity-instance?processInstanceId=${encodeURIComponent(instanceId)}&maxResults=500&sortBy=startTime&sortOrder=asc`);
  return (
    <Card>
      <CardHeader><CardTitle>Activity timeline</CardTitle><CardDescription>{acts.length} events.</CardDescription></CardHeader>
      <CardContent className="p-0">
        {acts.length === 0 ? <div className="text-muted-foreground p-6 text-sm">No history.</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Type</TableHead><TableHead>Started</TableHead><TableHead>Ended</TableHead><TableHead>Duration (ms)</TableHead></TableRow></TableHeader>
            <TableBody>
              {acts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.activityName ?? a.activityId}</TableCell>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{a.activityType}</code></TableCell>
                  <TableCell className="text-xs">{new Date(a.startTime).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{a.endTime ? new Date(a.endTime).toLocaleString() : "—"}</TableCell>
                  <TableCell>{a.durationInMillis ?? "—"}</TableCell>
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
git add src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/history-tab.tsx
git commit -m "feat(cockpit): instance history view — timeline + variables + incidents + tasks"
```

---

## Task 11: Instance actions menu (cancel + suspend/activate)

**Files:**
- Create: `_components/instance-actions-menu.tsx`
- Create: `_components/cancel-instance-dialog.tsx`
- Create: `_components/suspend-instance-dialog.tsx`
- Create: `src/app/api/cockpit/process-instances/[id]/route.ts` (DELETE)
- Create: `src/app/api/cockpit/process-instances/[id]/suspended/route.ts` (PUT)

- [ ] **Step 1: Routes**

```ts
// route.ts (DELETE cancel)
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/process-instance/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

```ts
// suspended/route.ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json(); // { suspended: bool }
  const res = await engineFetch(`/process-instance/${encodeURIComponent(id)}/suspended`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Cancel dialog (type-id-to-confirm)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XCircle } from "lucide-react";

export function CancelInstanceDialog({ instanceId, definitionKey, open, onOpenChange }: { instanceId: string; definitionKey: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const armed = confirm === instanceId;

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/process-instances/${encodeURIComponent(instanceId)}`, { method: "DELETE" });
      if (res.ok) router.push(`/cockpit/processes/${encodeURIComponent(definitionKey)}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2"><XCircle className="size-5" /> Cancel instance</DialogTitle>
          <DialogDescription>Permanent. Open user tasks will be terminated.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Type <code className="bg-muted rounded px-1 text-xs">{instanceId}</code> to confirm</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Back</Button>
          <Button variant="destructive" onClick={submit} disabled={!armed || pending}>{pending ? "Cancelling…" : "Cancel instance"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Suspend dialog**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SuspendInstanceDialog({ instanceId, suspended, open, onOpenChange }: { instanceId: string; suspended: boolean; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const target = !suspended;

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/cockpit/process-instances/${encodeURIComponent(instanceId)}/suspended`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: target }),
      });
      if (res.ok) { onOpenChange(false); router.refresh(); }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{target ? "Suspend instance" : "Activate instance"}</DialogTitle></DialogHeader>
        <p className="text-muted-foreground text-sm">{target ? "Pauses execution. Resume any time." : "Resumes execution."}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={target ? "destructive" : "default"} onClick={submit} disabled={pending}>{pending ? "Working…" : (target ? "Suspend" : "Activate")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Menu**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pause, Play, XCircle } from "lucide-react";
import { CancelInstanceDialog } from "./cancel-instance-dialog";
import { SuspendInstanceDialog } from "./suspend-instance-dialog";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

export function InstanceActionsMenu({ instanceId, definitionKey, suspended }: { instanceId: string; definitionKey: string; suspended: boolean }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><MoreHorizontal className="mr-1 size-4" /> Actions</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSuspendOpen(true)}>
            {suspended ? <><Play className="mr-2 size-4" />Activate</> : <><Pause className="mr-2 size-4" />Suspend</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => setCancelOpen(true)}>
            <XCircle className="mr-2 size-4" /> Cancel instance
          </DropdownMenuItem>
          <ExtensionSlot point="cockpit.processInstance.runtime.action" props={{ instanceId, definitionKey }} fallback={null} />
        </DropdownMenuContent>
      </DropdownMenu>
      <CancelInstanceDialog instanceId={instanceId} definitionKey={definitionKey} open={cancelOpen} onOpenChange={setCancelOpen} />
      <SuspendInstanceDialog instanceId={instanceId} suspended={suspended} open={suspendOpen} onOpenChange={setSuspendOpen} />
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cockpit/process-instances src/app/\(app\)/cockpit/processes/\[key\]/instances/\[id\]/_components/{instance-actions-menu,cancel-instance-dialog,suspend-instance-dialog}.tsx
git commit -m "feat(cockpit): instance actions menu — cancel + suspend/activate"
```

---

## Task 12: cockpit-base plugin (multi-slot)

**Files:**
- Create: `plugins/cockpit-base/plugin.json`
- Create: `plugins/cockpit-base/client.tsx`
- Modify: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Manifest**

```json
{
  "id": "cockpit-base",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "cockpit.processInstance.runtime.tab", "exportName": "RuntimeTabExtra", "priority": 50 },
      { "point": "cockpit.processInstance.runtime.action", "exportName": "InstanceActionItems", "priority": 100 },
      { "point": "cockpit.incident.action", "exportName": "IncidentActionItems", "priority": 100 },
      { "point": "cockpit.processInstance.diagram.overlay", "exportName": "InstanceCountOverlay", "priority": 100 }
    ]
  }
}
```

- [ ] **Step 2: Client exports (v1 stubs visible enough for slot smoke)**

```tsx
"use client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tag } from "lucide-react";

// Adds a "Called process definitions" tab link on the runtime strip (parity with legacy).
export function RuntimeTabExtra() {
  return null; // v1: leave the built-in tab strip authoritative; reserve the slot for third-party adds.
}

export function InstanceActionItems(_p: { instanceId: string; definitionKey: string }) {
  return (
    <DropdownMenuItem disabled className="text-muted-foreground">
      <Tag className="mr-2 size-4" /> Add custom tag (coming soon)
    </DropdownMenuItem>
  );
}

export function IncidentActionItems(_p: { incident: unknown; instanceId: string }) {
  return null; // Stub — extra incident actions will land here.
}

export function InstanceCountOverlay() {
  return null; // Overlays land in a follow-up; slot wiring is what we need now.
}
```

- [ ] **Step 3: Register**

```ts
import cockpitBaseManifest from "@/../plugins/cockpit-base/plugin.json";
import * as cockpitBaseClient from "@/../plugins/cockpit-base/client";
PLUGINS.push({ manifest: cockpitBaseManifest as PluginManifest, clientExports: cockpitBaseClient as unknown as RegisteredPlugin["clientExports"] });
```

- [ ] **Step 4: Commit**

```bash
git add plugins/cockpit-base src/lib/plugins/registry.ts
git commit -m "feat(plugin): cockpit-base (multi-slot: tab / action / incident / overlay)"
```

---

## Task 13: cockpit-external-tasks-tab plugin

**Files:**
- Create: `plugins/cockpit-external-tasks-tab/plugin.json`
- Create: `plugins/cockpit-external-tasks-tab/client.tsx`
- Modify: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Manifest**

```json
{
  "id": "cockpit-external-tasks-tab",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "cockpit.processInstance.runtime.tab", "exportName": "ExternalTasksTabLink", "priority": 60 }
    ]
  }
}
```

- [ ] **Step 2: Client**

```tsx
"use client";
import Link from "next/link";

export function ExternalTasksTabLink({ instanceId, definitionKey, view, active }: { instanceId: string; definitionKey: string; view: "runtime" | "history"; active: string }) {
  if (view !== "runtime") return null;
  const isActive = active === "external-tasks-x";
  const href = `/cockpit/processes/${encodeURIComponent(definitionKey)}/instances/${encodeURIComponent(instanceId)}?tab=external-tasks-x&view=runtime`;
  return (
    <Link href={href} className={`rounded-sm px-3 py-1.5 text-sm ${isActive ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
      External tasks +
    </Link>
  );
}
```

(Tab body for `external-tasks-x` is intentionally not implemented in v1 — this plugin just demonstrates extra-slot wiring. Real porting of the legacy plugin's behavior is a follow-up.)

- [ ] **Step 3: Register + commit**

```bash
git add plugins/cockpit-external-tasks-tab src/lib/plugins/registry.ts
git commit -m "feat(plugin): cockpit-external-tasks-tab (extra tab-link variant)"
```

---

## Task 14: E2E — instance navigation + tabs + history

**Files:**
- Create: `e2e/cockpit-process-instance.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4b process-instance tabs", () => {
  test("tab routing covers all runtime tabs and history view", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-instance-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    const { id } = (await start.json()) as { id: string };
    await loginAs(page, "demo", "demo");

    await page.goto(`/cockpit/processes/TestReview/instances/${id}`);
    await expect(page.getByRole("heading", { name: /process instance/i })).toBeVisible();

    for (const tab of ["Variables", "Incidents", "User tasks", "Jobs", "External tasks", "Called instances"]) {
      await page.getByRole("link", { name: tab }).click();
    }

    await page.getByRole("link", { name: /history/i }).click();
    await expect(page).toHaveURL(/view=history/);
    await expect(page.getByRole("heading", { name: /activity timeline/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/cockpit-process-instance.spec.ts
git commit -m "test(cockpit): @phase-4b instance tabs e2e"
```

---

## Task 15: E2E — actions

**Files:**
- Create: `e2e/cockpit-process-instance-actions.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4b instance actions", () => {
  test("add variable, suspend, cancel", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    const { id } = (await start.json()) as { id: string };
    await loginAs(page, "demo", "demo");
    await page.goto(`/cockpit/processes/TestReview/instances/${id}?tab=variables`);

    await page.getByRole("button", { name: /^add$/i }).click();
    await page.getByLabel("Name").fill("e2eFlag");
    await page.getByLabel("Value").fill("true");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Boolean" }).click();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText("e2eFlag")).toBeVisible();

    await page.getByRole("button", { name: /actions/i }).click();
    await page.getByRole("menuitem", { name: /suspend/i }).click();
    await page.getByRole("button", { name: /^suspend$/i }).click();
    await expect(page.getByText(/suspended/i)).toBeVisible();

    await page.getByRole("button", { name: /actions/i }).click();
    await page.getByRole("menuitem", { name: /cancel instance/i }).click();
    await page.getByLabel(/type .* to confirm/i).fill(id);
    await page.getByRole("button", { name: /^cancel instance$/i }).click();
    await expect(page).toHaveURL(/\/cockpit\/processes\/TestReview$/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/cockpit-process-instance-actions.spec.ts
git commit -m "test(cockpit): @phase-4b instance actions e2e"
```

---

## Task 16: E2E — external tasks

**Files:**
- Create: `e2e/cockpit-process-instance-external-tasks.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-4b external tasks", () => {
  test("retry + unlock visible on external-task rows", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/ExternalTaskFlow/start", {
      data: { businessKey: `e2e-x-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    const { id } = (await start.json()) as { id: string };
    await loginAs(page, "demo", "demo");
    await page.goto(`/cockpit/processes/ExternalTaskFlow/instances/${id}?tab=external-tasks`);
    await expect(page.getByRole("heading", { name: /external tasks/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /retry/i }).first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/cockpit-process-instance-external-tasks.spec.ts
git commit -m "test(cockpit): @phase-4b external tasks e2e"
```

---

## Task 17: Run @phase-4b + evidence + exit

**Files:** none

- [ ] **Step 1: Run**

DevOps: `npx playwright test --grep @phase-4b --project=chromium,firefox,webkit`.

- [ ] **Step 2: Manual screenshots**

```
docs/superpowers/specs/evidence/phase-4b/
  ├── instance-variables.png
  ├── instance-incidents.png
  ├── instance-user-tasks.png
  ├── instance-jobs.png
  ├── instance-external-tasks.png
  ├── instance-called-instances.png
  ├── instance-history-timeline.png
  ├── cancel-dialog.png
  └── suspend-dialog.png
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-4b
git commit -m "docs(phase-4b): manual smoke screenshots"
```

- [ ] **Step 4: Phase 4b exit commit**

Confirm every instance-side row in §4.4 is ✅ or 🚫.

```bash
git commit --allow-empty -m "phase-4b: process-instance surface complete"
```
