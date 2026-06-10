# Phase 2 — Tasklist Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every ⬜ row in roadmap §4.2 so `/camunda/app/tasklist` can flip to webapps-next per Phase 2 exit criteria: claim/unclaim, complete (with forms), variables editor, identity links, comments, history, attachments, filters + filter editor, sort, the three tasklist plugins, keyboard shortcuts, navigation contributions.

**Architecture:** Server components by default (per §3.5); mutations via `/api/tasks/[id]/...` route handlers (already exist for claim/unclaim/complete/comments/assignee — patched/extended here, not reinvented); `@bpmn-io/form-js` mounted via UMD script-tag strategy (resolves the deferred Turbopack issue documented in `tasklist/[id]/page.tsx:15`); filters via search-params on the existing list page; plugin slots `tasklist.list`, `tasklist.card`, `tasklist.navbar.action`, `tasklist.task.action`, `tasklist.task.detail`, `tasklist.header` all wired through `ExtensionSlot`.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, `@bpmn-io/form-js` (already a dep), Playwright, Vitest (for filter URL serialization unit tests).

**Spec / inventory:** [`docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md`](../specs/2026-05-21-webapps-migration-roadmap-design.md) §4.2 + §5.2.

**Preconditions (must be merged before this plan executes):**
- Phase 0a — `webapps/webapp-rest/` module split
- Phase 0b — plugin contract + registry codegen
- Phase 0d — distro launcher `--ui` flag
- Phase 0f — `next-intl` i18n migration
- Phase 0g — Maven/npm/Playwright wiring
- Phase 0 (proxy/multi-engine/auth) — engine selector + CSRF + groups[] claim + cookie `engine` claim
- `2026-05-21-welcome-tasklist.md` — read-only tasklist list + welcome page

---

## Constraints binding this plan

- **Orchestrator must NOT auto-commit.** Per the user's global instructions, commit commands below are for the implementer to *show the user* and run only after explicit "commit." Default behavior: stop after each task, summarize the diff, wait for user direction.
- **Camunda formation roles:**
  - **FE agent** owns every file under `webapps-next/src/**`, `webapps-next/e2e/**`, `webapps-next/plugins/**`.
  - **BE agent** is only invoked for Task 0 (DTO confirmation) — no Java code lands.
  - **DevOps agent** runs every `npm` / `npx playwright` / Maven invocation.
- **Public API change rule (CLAUDE.md §6):** This plan must NOT propose engine-rest signature changes. If during execution a task reveals a missing endpoint or shape gap, stop and dispatch BE to discuss — do NOT widen the JAX-RS contract.
- **Engine prerequisite:** Camunda Run distro on `localhost:8080` with `demo`/`demo` admin and at least one deployed process that produces a user task with a form (test fixture: `bpmn/test-fixture.bpmn` to be deployed via Task 16).
- **`use client` discipline (per §3.5):** Page files stay server components. Any DOM/event/state work goes in `_components/*.tsx` marked `"use client"`.
- **Existing in-progress files:** The first step of every task that touches an existing file is "read the current implementation; reconcile diffs; if shape already matches, mark step done."

---

## Layout, Component & Typography Spec

Every page in this plan inherits the conventions below. Don't redefine inline — reference back here.

### Typography scale (Tailwind classes)

| Token | Class | When |
|---|---|---|
| `display` | `text-3xl font-semibold` | Stat value cards (e.g. open-task count on welcome). |
| `h1` page title | `text-2xl font-semibold tracking-tight` | One per page. Sits above a `text-muted-foreground text-sm` subtitle. |
| `h2` section | `text-lg font-semibold` | Card titles use `<CardTitle>` (already `text-base font-semibold` in shadcn); use `h2` only outside cards. |
| `h3` subsection | `text-sm font-medium` | Card sub-headers (stat titles, dropdown labels). |
| `body` | (default — `text-sm` in app shell) | Default. Don't restate. |
| `body-muted` | `text-muted-foreground text-sm` | Subtitles, descriptions, empty-state text. |
| `caption` | `text-xs text-muted-foreground` | Help text under inputs, timestamps. |
| `code` inline | `bg-muted rounded px-1 text-xs font-mono` | Engine IDs, REST paths, variable names. |
| `code` block | `bg-muted text-muted-foreground rounded p-3 text-xs font-mono` | JSON dumps (form schema, diagnostics). |

### Spacing scale

- Page-level vertical rhythm: `space-y-6`.
- Section header → first child: `space-y-1` for `h1 + subtitle`; `space-y-2` when followed by a "Back" button.
- Card → card: `gap-4` inside grids; `space-y-4` in single column.
- Inside `CardContent`: `pt-6` default; `p-0` when child is a `<Table>` (Table provides its own padding).
- Inline form rows: `flex gap-2` for tight, `flex gap-3` for label+input pairs, `space-y-3` between form fields.
- Badge cluster: `flex flex-wrap gap-2`.
- Table padding: don't override; use shadcn defaults.

### Color tokens (semantic, never raw)

- Default text: `text-foreground` (implicit).
- Muted: `text-muted-foreground`.
- Destructive (errors, delete buttons, overdue): `text-destructive`, `variant="destructive"` on Badge/Button.
- Surface tint: `bg-muted` (code, hover states).
- Card border on hover (interactive cards): `hover:border-primary/40 transition-colors`.

### Layout grid

**Tasklist list page (`/tasklist`)** — three-pane workspace defined by `_components/workspace.tsx`:

```
┌───────────────────────────────────────────────────────────────────┐
│  TopBar (app shell)                            <navbar.action>    │  ← plugin slot
├───────────────┬────────────────────────┬──────────────────────────┤
│ FilterRail    │ TaskCards (list)       │ TaskDetailPane           │
│ (240–280px)   │ (flex-1, max-w-md)     │ (flex-1)                 │
│               │  header: sort+slot     │                          │
│               │  body: scrollable      │                          │
│               │  footer: pagination    │                          │
└───────────────┴────────────────────────┴──────────────────────────┘
```

Container: `h-[calc(100svh-5rem)] md:h-[calc(100svh-6rem)]` (already in `page.tsx`).
Pane gap: `gap-0` with `border-r` between, or `gap-4` with surfaces. Match the existing workspace component — don't reinvent.

**Task detail page (`/tasklist/[id]`)** — single column, `space-y-6`:

1. Back link (`Button variant="ghost" size="sm"`).
2. Header: `flex flex-wrap items-end justify-between gap-3` — title block + badge cluster.
3. Action bar Card (`<TaskActions>`).
4. Form Card (if task has a form).
5. Variables editor Card (`<VariablesEditor>`).
6. Identity Links Card (`<IdentityLinksCard>`).
7. Comments Card (`<TaskComments>`).
8. Attachments Card (`<TaskAttachments>`).
9. History Card (`<TaskHistoryCard>`).

### Component composition rules

| Pattern | Use | Don't |
|---|---|---|
| Page title block | `<div className="space-y-1"><h1>...</h1><p className="text-muted-foreground text-sm">...</p></div>` | Heading without subtitle. Heading with a body-class size. |
| Section as Card | `<Card><CardHeader><CardTitle/><CardDescription/></CardHeader><CardContent/></Card>` | Bare `<section>` for grouped content. |
| Empty state | `<div className="text-muted-foreground p-6 text-sm">No X yet.</div>` | Spinners. Custom empty illustrations. |
| Error state | `<div className="text-destructive p-6 text-sm">Failed to load: {msg}</div>` | Toasts for load failures (toasts only for mutation feedback). |
| Mutation button | `<Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>` | Loading spinners overlaying disabled buttons. |
| Confirm-destructive | `<Dialog>` with destructive primary button. | `window.confirm`. |
| Editable list row | Read row → click pencil → row swaps to inputs → Save/Cancel inline. | Modal for trivial single-field edits. |
| Plugin slot | `<ExtensionSlot point="X" props={{...}} fallback={null} />` | Inlined per-feature dispatch tables. |

### Iconography (lucide-react)

| Domain | Icon |
|---|---|
| Tasklist | `ClipboardList` |
| Claim/assign | `UserPlus`, `User`, `UserMinus` |
| Complete | `Check`, `CheckCircle2` |
| Comment | `MessageSquare` |
| Attachment | `Paperclip` |
| Sort | `SlidersHorizontal`, `ArrowUpDown` |
| Search | `Search` |
| Filter | `Filter` |
| Add | `Plus` |
| Remove | `Trash2`, `X` |
| Save | `Save` |
| Back | `ArrowLeft` |
| Overdue/alert | `AlertCircle`, `AlertTriangle` |

Size: `size-4` in buttons, `size-5` in card-header decorations, `size-3` in dense badges.

### Dialogs & forms

- Trigger: usually `<Button variant="outline" size="sm">`.
- Width: shadcn `<DialogContent>` default; override only if a form needs >2 columns.
- Field stack: `space-y-3`; each field is `<div><Label>X</Label><Input/></div>`.
- Submit footer: `<DialogFooter>` with primary action right; secondary "Cancel" only if a destructive variant.

### Tables

- Always wrap in a Card; never bare.
- `<CardContent className="p-0">` when the child is `<Table>`.
- Column count: stay ≤ 5 visible at desktop; collapse to mobile-stacked rows only when explicitly asked (no virtualization in v1).
- Cell density: shadcn defaults; no custom `<td>` padding overrides.
- Mono columns (IDs, keys): `font-mono text-xs`.

### Responsive bar

- Breakpoints: only `md:` (768px) and `lg:` (1024px) are in use across `(app)/*`. Don't introduce `sm:` or `xl:` unless absolutely needed.
- Tasklist workspace stacks vertically below `md:`: FilterRail → TaskCards (TaskDetailPane hidden, navigate via `/tasklist/[id]` page).

---

## File Structure

**Already exists (reconciled, not rewritten):**

| File | Current state | This plan's delta |
|---|---|---|
| `src/app/(app)/tasklist/page.tsx` | List with `mine/claimable/all` filter | Add: filter sidebar with `tasklist.list` slot; pagination; sort dropdown |
| `src/app/(app)/tasklist/[id]/page.tsx` | Detail view, form deferred, comments shown | Re-enable form-js (Task 5); add identity links section; add history tab; add attachments section |
| `src/app/(app)/tasklist/_components/filter-rail.tsx` | mine/claimable/all radio | Add: saved-filter dropdown; "Edit filters" button |
| `src/app/(app)/tasklist/_components/task-actions.tsx` | claim/unclaim/complete buttons | Extend: assign-to-user submenu; resolve-delegation; identity-link mgmt entry |
| `src/app/(app)/tasklist/_components/task-comments.tsx` | comments list + add form | No change (Task 0 confirms shape) |
| `src/app/(app)/tasklist/_components/task-form-internal.tsx` | placeholder (deferred) | Replace with UMD-loader form-js renderer |
| `src/app/(app)/tasklist/_components/task-form.tsx` | dynamic import wrapper | Replace with `<TaskFormUmd>` (Task 5) |
| `src/app/(app)/tasklist/_components/workspace.tsx` | three-pane split | Add: collapsible filter rail + plugin header slot |
| `src/app/api/tasks/[id]/{assignee,claim,unclaim,complete,comments}/route.ts` | basic handlers | Audit each: add CSRF (per Phase 0) + error normalization; no signature change |

**Net-new files:**

| File | Responsibility |
|---|---|
| `src/app/(app)/tasklist/_components/filter-editor.tsx` | Client dialog: create/update/delete `engine-rest/filter` resources (assignee/candidateGroup/processVariables/sortBy). |
| `src/app/(app)/tasklist/_components/filter-list.tsx` | Server component rendering the user's saved filters; clicking sets `?filterId=`. |
| `src/app/(app)/tasklist/_components/sort-control.tsx` | Client dropdown writing `?sortBy=&sortOrder=`. |
| `src/app/(app)/tasklist/_components/identity-links-card.tsx` | Server component: list candidate users/groups; client child for add/delete via `/api/tasks/[id]/identity-links`. |
| `src/app/(app)/tasklist/_components/task-history-card.tsx` | Server component: render `GET /history/user-operation?taskId=` and `GET /history/task?taskId=`. |
| `src/app/(app)/tasklist/_components/task-attachments.tsx` | Server-list + client uploader hitting `/api/tasks/[id]/attachments`. |
| `src/app/(app)/tasklist/_components/keyboard-shortcuts.tsx` | Client component: registers global keydown for j/k/c/x/enter (scoped to `/tasklist` routes). |
| `src/app/(app)/tasklist/_components/standalone-task-button.tsx` | Mounted into `tasklist.navbar.action` slot via the standalone-task plugin (file lives in plugin dir, this is the *host* slot adapter). |
| `src/app/api/tasks/[id]/identity-links/route.ts` | GET (list) / POST (add) / DELETE (remove) via `engine-rest/task/{id}/identity-links`. |
| `src/app/api/tasks/[id]/attachments/route.ts` | GET (list) / POST (multipart upload) — proxies `engine-rest/task/{id}/attachment`. |
| `src/app/api/tasks/[id]/attachments/[attachmentId]/route.ts` | GET (download stream) / DELETE. |
| `src/app/api/tasks/[id]/resolve/route.ts` | POST `engine-rest/task/{id}/resolve` for delegated tasks. |
| `src/app/api/filters/route.ts` | GET (list user's filters) / POST (create). |
| `src/app/api/filters/[id]/route.ts` | GET / PUT / DELETE — proxies `engine-rest/filter/{id}`. |
| `src/app/api/filters/[id]/list/route.ts` | GET — executes filter via `engine-rest/filter/{id}/list`. |
| `src/components/form-js-umd-loader.tsx` | Client component: appends `<script>` tag for `@bpmn-io/form-js` UMD bundle; resolves promise when `window.FormJs` is ready. Shared by tasklist + future process-instance start-form. |
| `public/vendor/form-js/form-viewer.umd.js` | Static UMD bundle copy from `node_modules/@bpmn-io/form-js/dist/`. Generated by a postinstall script. |
| `public/vendor/form-js/form-viewer.css` | Companion CSS. |
| `plugins/tasklist-sorting/plugin.json` | Plugin manifest registering into `tasklist.list`. |
| `plugins/tasklist-sorting/client.tsx` | Adds advanced sort criteria (priority, due, follow-up, custom variables) to the list. |
| `plugins/tasklist-card/plugin.json` | Plugin manifest registering into `tasklist.card`. |
| `plugins/tasklist-card/client.tsx` | Per-card extra row (due-date badge + process key); replaces inline card extras. |
| `plugins/tasklist-standalone-task/plugin.json` | Registers into `tasklist.navbar.action`. |
| `plugins/tasklist-standalone-task/client.tsx` | Modal opener; submits to `engine-rest/task/create`. |
| `plugins/tasklist-standalone-task/server.ts` | Server action wrapper for create (also exposes `/api/plugin/tasklist-standalone-task/create`). |
| `e2e/tasklist-claim-complete.spec.ts` | Claim a candidate-group task, complete it without a form. |
| `e2e/tasklist-form-complete.spec.ts` | Complete a task with a deployed form (variable round-trip). |
| `e2e/tasklist-filters.spec.ts` | Save a filter, switch to it, sort, paginate. |
| `e2e/tasklist-comments-attachments.spec.ts` | Add a comment, upload + download an attachment. |
| `e2e/tasklist-standalone-task.spec.ts` | Create a standalone task via plugin button; appears in inbox. |
| `e2e/_fixtures/test-process.bpmn` | Process definition with a user task + deployed form for fixture deployment. |
| `e2e/_fixtures/test-form.form` | Deployed form schema (input field + button). |
| `scripts/copy-form-js-umd.mjs` | Postinstall step: copies form-js UMD + CSS from node_modules into `public/vendor/form-js/`. |
| `vitest.config.ts` | Add (if not present) — runs unit tests for filter URL serialization. |
| `src/lib/tasklist/filter-url.ts` | Pure functions: `filterToParams(filter): URLSearchParams` and `paramsToFilter(p): Filter`. |
| `src/lib/tasklist/filter-url.test.ts` | Vitest unit tests for the above. |

**Not touched (explicit):** `engine.ts`, `session.ts`, `proxy.ts`, `(app)/layout.tsx`, any shadcn primitive, any Java file.

---

## Task 0: BE handoff — confirm DTO shapes

**Files:** none (read-only investigation, no code change)

- [ ] **Step 1: Dispatch BE persona to confirm DTOs**

Orchestrator dispatches a `general-purpose` agent with the BE persona pasted in, with this task:

> Read-only investigation. Confirm the following JSON shapes from `engine-rest/engine-rest/src/main/java/org/camunda/bpm/engine/rest/`:
> 1. `GET /task/{id}/identity-links` → `IdentityLinkDto[]` with fields `userId`, `groupId`, `type` (string: candidate/assignee/owner).
> 2. `GET /task/{id}/attachment` → `AttachmentDto[]` with fields `id`, `name`, `description`, `type`, `url`, `taskId`.
> 3. `POST /task/{id}/attachment/create` — multipart fields: `attachment-name`, `attachment-description`, `attachment-type`, `content` (file part) OR `url` (form field).
> 4. `GET /history/user-operation?taskId={id}` → `UserOperationLogEntryDto[]` with `id`, `userId`, `timestamp`, `operationType`, `property`, `orgValue`, `newValue`.
> 5. `GET /history/task?taskId={id}` → `HistoricTaskInstanceDto[]` (start/end times for the task lifecycle).
> 6. `engine-rest/filter` GET/POST/PUT shape — confirm `FilterDto` has `id`, `name`, `owner`, `resourceType`, `query` (object), `properties` (object), `itemCount`.
> 7. `POST /task/create` — `TaskDto` fields accepted on creation (esp. `name`, `description`, `assignee`, `priority`, `due`).
> 8. Whether `engine-rest/task/{id}/resolve` requires a body and what fields.

Return a markdown report; no code changes.

- [ ] **Step 2: Capture report under `docs/superpowers/specs/evidence/phase-2/be-dto-report.md`**

If a field differs from what later tasks reference, **patch the corresponding task in this plan** before continuing. Do not edit code with a guessed shape.

- [ ] **Step 3: Commit the report**

```bash
git add docs/superpowers/specs/evidence/phase-2/be-dto-report.md
git commit -m "docs(phase-2): capture engine-rest DTO shapes for tasklist completion"
```

---

## Task 1: Reconcile existing in-progress files

**Files:**
- Read: every file under `src/app/(app)/tasklist/` and `src/app/api/tasks/`
- Write: `docs/superpowers/specs/evidence/phase-2/reconcile.md` (one-shot inventory)

- [ ] **Step 1: Read each existing file**

For each file in `src/app/(app)/tasklist/**` and `src/app/api/tasks/**`, record:
- File path
- Current public exports
- Behavior implemented vs. behavior promised by this plan (see File Structure table)
- Any TODO/FIXME comments

- [ ] **Step 2: Write `reconcile.md`**

For each task in this plan (2–25), one line:

```
Task N — <name>: <status>
  blocking: <files missing | files partial | none>
```

- [ ] **Step 3: Patch this plan's task ordering if needed**

If reconcile reveals a task is already ✅ (matches the plan's intent), mark it ✅ in the plan and skip implementation. If a step's expected starting code differs from current code, patch the step inline.

- [ ] **Step 4: Commit the reconcile report**

```bash
git add docs/superpowers/specs/evidence/phase-2/reconcile.md
git commit -m "docs(phase-2): reconcile in-progress tasklist state vs. plan"
```

---

## Task 2: Audit CSRF + error envelope on existing route handlers

**Files:**
- Modify: `src/app/api/tasks/[id]/{claim,unclaim,complete,assignee,comments}/route.ts`

- [ ] **Step 1: Read the existing route handler for the `claim` endpoint**

Path: `src/app/api/tasks/[id]/claim/route.ts`. Confirm it currently:
- Reads the session via `getSession()`.
- Calls `engineFetch('/task/{id}/claim', { method: 'POST', body: JSON.stringify({ userId: session.username }) })`.

- [ ] **Step 2: Add the CSRF middleware import**

Phase 0 ships `src/lib/auth/csrf.ts` with `verifyCsrfFromRequest(req): Promise<void>` that throws on mismatch. Wrap each handler:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  // ...existing body...
}
```

- [ ] **Step 3: Normalize the error response shape**

Replace ad-hoc `Response.json({ error })` calls with:

```ts
function engineError(status: number, message: string) {
  return Response.json({ error: { status, message } }, { status });
}
```

Wrap the handler body in a try/catch:

```ts
try {
  const res = await engineFetch(...);
  if (!res.ok) return engineError(res.status, `engine returned ${res.status}`);
  return new Response(null, { status: 204 });
} catch (err) {
  return engineError(500, err instanceof Error ? err.message : "Unknown");
}
```

- [ ] **Step 4: Apply the same pattern to unclaim/complete/assignee/comments**

Files: `unclaim/route.ts`, `complete/route.ts`, `assignee/route.ts`, `comments/route.ts`. Same wrapper, same envelope.

- [ ] **Step 5: Add a unit test for `verifyCsrfFromRequest` integration**

(Skip if Phase 0 already ships one — confirm by running `npx vitest run src/lib/auth/csrf.test.ts`.)

- [ ] **Step 6: Run Playwright auth suite (regression check)**

DevOps handoff: run `npx playwright test --grep @phase-0` and confirm green. If red, fix CSRF wiring before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tasks
git commit -m "feat(tasklist): CSRF gate + error envelope on task mutation routes"
```

---

## Task 3: Identity links — server card + mutation endpoints

**Files:**
- Create: `src/app/api/tasks/[id]/identity-links/route.ts`
- Create: `src/app/(app)/tasklist/_components/identity-links-card.tsx`
- Modify: `src/app/(app)/tasklist/[id]/page.tsx` (mount the card)

- [ ] **Step 1: Write the route handler**

`src/app/api/tasks/[id]/identity-links/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

type IdentityLink = { userId: string | null; groupId: string | null; type: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const links = await engineGet<IdentityLink[]>(`/task/${encodeURIComponent(id)}/identity-links`);
    return Response.json(links);
  } catch (err) {
    return Response.json({ error: { status: 500, message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = (await req.json()) as IdentityLink;
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/identity-links`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = (await req.json()) as IdentityLink;
  // engine-rest uses POST /identity-links/delete (legacy quirk)
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/identity-links/delete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Write the card component (server + client child)**

`src/app/(app)/tasklist/_components/identity-links-card.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { IdentityLinksEditor } from "./identity-links-editor";

type IdentityLink = { userId: string | null; groupId: string | null; type: string };

export async function IdentityLinksCard({ taskId }: { taskId: string }) {
  let links: IdentityLink[] = [];
  try {
    links = await engineGet<IdentityLink[]>(`/task/${encodeURIComponent(taskId)}/identity-links`);
  } catch {
    /* surfaced as empty list */
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidates</CardTitle>
        <CardDescription>Users and groups who can claim this task.</CardDescription>
      </CardHeader>
      <CardContent>
        <IdentityLinksEditor taskId={taskId} initial={links} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Write the client editor**

`src/app/(app)/tasklist/_components/identity-links-editor.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

type IdentityLink = { userId: string | null; groupId: string | null; type: string };

export function IdentityLinksEditor({ taskId, initial }: { taskId: string; initial: IdentityLink[] }) {
  const [links, setLinks] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState("");
  const [draftKind, setDraftKind] = useState<"user" | "group">("user");

  const addLink = () => {
    if (!draftId.trim()) return;
    const link: IdentityLink = {
      userId: draftKind === "user" ? draftId : null,
      groupId: draftKind === "group" ? draftId : null,
      type: "candidate",
    };
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/identity-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      });
      if (res.ok) {
        setLinks((prev) => [...prev, link]);
        setDraftId("");
      }
    });
  };

  const removeLink = (link: IdentityLink) => {
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/identity-links`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      });
      if (res.ok) setLinks((prev) => prev.filter((l) => l !== link));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {links.filter((l) => l.type === "candidate").length === 0 ? (
          <span className="text-muted-foreground text-sm">No candidates configured.</span>
        ) : (
          links
            .filter((l) => l.type === "candidate")
            .map((l) => (
              <Badge key={`${l.userId ?? ""}|${l.groupId ?? ""}`} variant="secondary" className="gap-1">
                {l.userId ? `user:${l.userId}` : `group:${l.groupId}`}
                <button onClick={() => removeLink(l)} className="hover:text-destructive" disabled={pending} aria-label="Remove">
                  <X className="size-3" />
                </button>
              </Badge>
            ))
        )}
      </div>
      <div className="flex gap-2">
        <Select value={draftKind} onValueChange={(v) => setDraftKind(v as "user" | "group")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="group">Group</SelectItem>
          </SelectContent>
        </Select>
        <Input value={draftId} onChange={(e) => setDraftId(e.target.value)} placeholder="id" />
        <Button onClick={addLink} disabled={pending || !draftId.trim()}>Add</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount the card in the task detail page**

In `src/app/(app)/tasklist/[id]/page.tsx`, import and render between the Variables card and the Comments card:

```tsx
import { IdentityLinksCard } from "../_components/identity-links-card";
// ...
<IdentityLinksCard taskId={task.id} />
```

- [ ] **Step 5: Test manually**

DevOps handoff: launch dev server. Navigate to a task. Add a candidate user `demo`. Verify it appears, then remove it. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tasks/[id]/identity-links src/app/\(app\)/tasklist/_components/identity-links-card.tsx src/app/\(app\)/tasklist/_components/identity-links-editor.tsx src/app/\(app\)/tasklist/\[id\]/page.tsx
git commit -m "feat(tasklist): identity links editor (candidate users/groups)"
```

---

## Task 4: Form-js UMD loader

**Files:**
- Create: `scripts/copy-form-js-umd.mjs`
- Create: `src/components/form-js-umd-loader.tsx`
- Modify: `package.json` (postinstall + public/vendor entry)

- [ ] **Step 1: Write the postinstall copy script**

`scripts/copy-form-js-umd.mjs`:

```js
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/@bpmn-io/form-js/dist");
const dst = resolve(root, "public/vendor/form-js");
const files = ["form-viewer.umd.js", "assets/form-js.css"];

if (!existsSync(src)) {
  console.warn("[copy-form-js-umd] form-js not installed; skipping.");
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
for (const f of files) {
  const s = resolve(src, f);
  const d = resolve(dst, f.split("/").pop());
  if (existsSync(s)) cpSync(s, d);
}
console.log("[copy-form-js-umd] copied form-js assets to public/vendor/form-js/");
```

- [ ] **Step 2: Wire postinstall in `package.json`**

Show current `scripts` block; add or extend:

```json
"scripts": {
  "postinstall": "node scripts/copy-form-js-umd.mjs"
}
```

- [ ] **Step 3: Run the postinstall manually**

DevOps handoff: `node scripts/copy-form-js-umd.mjs`. Confirm `public/vendor/form-js/form-viewer.umd.js` exists.

- [ ] **Step 4: Write the loader component**

`src/components/form-js-umd-loader.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    FormJs?: { Form: new (opts: { container: HTMLElement }) => FormInstance };
  }
}

type FormInstance = {
  importSchema(schema: object, data?: object): Promise<unknown>;
  submit(): { data: Record<string, unknown>; errors: Record<string, string[]> };
  destroy(): void;
  on(ev: string, fn: (...args: unknown[]) => void): void;
};

let loadPromise: Promise<void> | null = null;
function loadFormJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.FormJs) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/form-js/form-js.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/vendor/form-js/form-viewer.umd.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("form-js failed to load"));
    document.body.appendChild(s);
  });
  return loadPromise;
}

export function useFormJs(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.FormJs);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadFormJs()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "load error"));
  }, []);
  return { ready, error };
}

export type { FormInstance };
```

- [ ] **Step 5: Commit**

```bash
git add scripts/copy-form-js-umd.mjs src/components/form-js-umd-loader.tsx package.json public/vendor/form-js
git commit -m "feat: form-js UMD loader (resolves Turbopack dev-bundle deferral)"
```

---

## Task 5: Wire the form into the task detail page

**Files:**
- Modify: `src/app/(app)/tasklist/_components/task-form-internal.tsx`
- Modify: `src/app/(app)/tasklist/_components/task-form.tsx`
- Modify: `src/app/(app)/tasklist/[id]/page.tsx` (re-enable the import)

- [ ] **Step 1: Read the current placeholder**

`task-form-internal.tsx` currently renders a placeholder. Replace with the UMD-loader-backed renderer.

- [ ] **Step 2: Replace `task-form-internal.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { type FormInstance, useFormJs } from "@/components/form-js-umd-loader";
import { Button } from "@/components/ui/button";

export function TaskFormInternal({
  taskId,
  schema,
  initialData,
  onCompleted,
}: {
  taskId: string;
  schema: object;
  initialData: Record<string, unknown>;
  onCompleted?: () => void;
}) {
  const { ready, error } = useFormJs();
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<FormInstance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.FormJs) return;
    const form = new window.FormJs.Form({ container: containerRef.current });
    formRef.current = form;
    form.importSchema(schema, initialData);
    return () => form.destroy();
  }, [ready, schema, initialData]);

  const onSubmit = async () => {
    if (!formRef.current) return;
    const { data, errors } = formRef.current.submit();
    if (errors && Object.keys(errors).length > 0) {
      setSubmitError("Form has validation errors.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: serializeVariables(data) }),
    });
    if (!res.ok) {
      setSubmitting(false);
      setSubmitError(`Complete failed: ${res.status}`);
      return;
    }
    onCompleted?.();
  };

  if (error) return <p className="text-destructive text-sm">Form failed to load: {error}</p>;
  if (!ready) return <p className="text-muted-foreground text-sm">Loading form…</p>;

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="form-js" />
      {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
      <Button onClick={onSubmit} disabled={submitting}>{submitting ? "Submitting…" : "Complete task"}</Button>
    </div>
  );
}

function serializeVariables(data: Record<string, unknown>): Record<string, { value: unknown; type: string }> {
  const out: Record<string, { value: unknown; type: string }> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") out[k] = { value: v, type: "String" };
    else if (typeof v === "number") out[k] = { value: v, type: Number.isInteger(v) ? "Long" : "Double" };
    else if (typeof v === "boolean") out[k] = { value: v, type: "Boolean" };
    else if (v instanceof Date) out[k] = { value: v.toISOString(), type: "Date" };
    else out[k] = { value: JSON.stringify(v), type: "Json" };
  }
  return out;
}
```

- [ ] **Step 3: Replace `task-form.tsx` (the wrapper)**

```tsx
"use client";
import { TaskFormInternal } from "./task-form-internal";

export function TaskForm(props: {
  taskId: string;
  schema: object;
  initialData: Record<string, unknown>;
  onCompleted?: () => void;
}) {
  return <TaskFormInternal {...props} />;
}
```

- [ ] **Step 4: Re-enable the import in the detail page**

In `src/app/(app)/tasklist/[id]/page.tsx`, delete the `TODO(form-js)` comment block (lines 15–18) and:

```tsx
import { TaskForm } from "../_components/task-form";
// ...
{form ? (
  <Card>
    <CardHeader>
      <CardTitle>Task form</CardTitle>
      <CardDescription>Fill in the form to complete this task.</CardDescription>
    </CardHeader>
    <CardContent>
      <TaskForm taskId={task.id} schema={form} initialData={initialFormData} />
    </CardContent>
  </Card>
) : null}
```

Remove the JSON-pre fallback inside the form card.

- [ ] **Step 5: Test manually**

DevOps handoff: deploy `e2e/_fixtures/test-process.bpmn` (Task 16 ships this — for now, deploy any process with a form). Start instance. Claim resulting task. Verify form renders, validates, submits, and the task disappears from the inbox.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/tasklist/_components/task-form*.tsx src/app/\(app\)/tasklist/\[id\]/page.tsx
git commit -m "feat(tasklist): wire form-js renderer for task forms"
```

---

## Task 6: Variables editor (replace read-only table)

**Files:**
- Create: `src/app/(app)/tasklist/_components/variables-editor.tsx`
- Create: `src/app/api/tasks/[id]/variables/[name]/route.ts`
- Modify: `src/app/(app)/tasklist/[id]/page.tsx`

- [ ] **Step 1: Write the variable PUT/DELETE endpoint**

`src/app/api/tasks/[id]/variables/[name]/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, name } = await params;
  const body = await req.json();
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/variables/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, name } = await params;
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/variables/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Write the editor client component**

`src/app/(app)/tasklist/_components/variables-editor.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2 } from "lucide-react";

type Variable = { type: string; value: unknown };
type Editable = { name: string; type: string; value: string; existing: boolean; dirty: boolean };

const TYPES = ["String", "Long", "Double", "Boolean", "Date", "Json"];

function fromMap(map: Record<string, Variable>): Editable[] {
  return Object.entries(map).map(([name, v]) => ({
    name,
    type: v.type,
    value: v.value === null || v.value === undefined ? "" : typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value),
    existing: true,
    dirty: false,
  }));
}

function castValue(type: string, raw: string): unknown {
  if (type === "Boolean") return raw === "true";
  if (type === "Long") return Number.parseInt(raw, 10);
  if (type === "Double") return Number.parseFloat(raw);
  if (type === "Json") return JSON.parse(raw);
  return raw;
}

export function VariablesEditor({ taskId, initial }: { taskId: string; initial: Record<string, Variable> }) {
  const [rows, setRows] = useState<Editable[]>(fromMap(initial));
  const [pending, startTransition] = useTransition();

  const update = (idx: number, patch: Partial<Editable>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)));

  const save = (idx: number) => {
    const row = rows[idx];
    if (!row || !row.name.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/variables/${encodeURIComponent(row.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: castValue(row.type, row.value), type: row.type }),
      });
      if (res.ok) update(idx, { existing: true, dirty: false });
    });
  };

  const remove = (idx: number) => {
    const row = rows[idx];
    if (!row) return;
    if (!row.existing) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/variables/${encodeURIComponent(row.name)}`, {
        method: "DELETE",
      });
      if (res.ok) setRows((prev) => prev.filter((_, i) => i !== idx));
    });
  };

  const addNew = () =>
    setRows((prev) => [...prev, { name: "", type: "String", value: "", existing: false, dirty: true }]);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={`${r.name}-${idx}`}>
              <TableCell>
                <Input value={r.name} onChange={(e) => update(idx, { name: e.target.value })} disabled={r.existing} />
              </TableCell>
              <TableCell>
                <Select value={r.type} onValueChange={(v) => update(idx, { type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input value={r.value} onChange={(e) => update(idx, { value: e.target.value })} />
              </TableCell>
              <TableCell className="space-x-1">
                <Button size="icon" variant="ghost" onClick={() => save(idx)} disabled={pending || !r.dirty}><Save className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(idx)} disabled={pending}><Trash2 className="size-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="outline" size="sm" onClick={addNew}><Plus className="mr-1 size-4" /> Add variable</Button>
    </div>
  );
}
```

- [ ] **Step 3: Replace the read-only variables table in `tasklist/[id]/page.tsx`**

Swap the `<Table>...</Table>` block inside the "Variables" Card for `<VariablesEditor taskId={task.id} initial={variables} />`. Keep the empty-state.

- [ ] **Step 4: Test manually**

DevOps handoff: edit an existing variable, add a new String, add a Boolean, delete one. Confirm via `GET /api/engine/task/{id}/variables`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/\[id\]/variables src/app/\(app\)/tasklist/_components/variables-editor.tsx src/app/\(app\)/tasklist/\[id\]/page.tsx
git commit -m "feat(tasklist): variables editor (PUT/DELETE per name)"
```

---

## Task 7: Task history card

**Files:**
- Create: `src/app/(app)/tasklist/_components/task-history-card.tsx`
- Modify: `src/app/(app)/tasklist/[id]/page.tsx`

- [ ] **Step 1: Write the history card**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type UserOp = {
  id: string;
  userId: string | null;
  timestamp: string;
  operationType: string;
  property: string | null;
  orgValue: string | null;
  newValue: string | null;
};

async function load(taskId: string): Promise<UserOp[]> {
  try {
    return await engineGet<UserOp[]>(`/history/user-operation?taskId=${encodeURIComponent(taskId)}&sortBy=timestamp&sortOrder=desc&maxResults=100`);
  } catch {
    return [];
  }
}

export async function TaskHistoryCard({ taskId }: { taskId: string }) {
  const ops = await load(taskId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>User operation log for this task.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {ops.length === 0 ? (
          <div className="text-muted-foreground p-6 text-sm">No history yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-xs">{new Date(o.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{o.userId ?? "system"}</TableCell>
                  <TableCell><code className="bg-muted rounded px-1 text-xs">{o.operationType}</code></TableCell>
                  <TableCell>{o.property ?? "—"}</TableCell>
                  <TableCell className="text-xs">{o.orgValue ?? "—"} → {o.newValue ?? "—"}</TableCell>
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

- [ ] **Step 2: Mount in task detail page**

Below the Comments component:

```tsx
import { TaskHistoryCard } from "../_components/task-history-card";
// ...
<TaskHistoryCard taskId={task.id} />
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/tasklist/_components/task-history-card.tsx src/app/\(app\)/tasklist/\[id\]/page.tsx
git commit -m "feat(tasklist): user-operation history card on task detail"
```

---

## Task 8: Task attachments (list + upload + download + delete)

**Files:**
- Create: `src/app/api/tasks/[id]/attachments/route.ts`
- Create: `src/app/api/tasks/[id]/attachments/[attachmentId]/route.ts`
- Create: `src/app/(app)/tasklist/_components/task-attachments.tsx`
- Modify: `src/app/(app)/tasklist/[id]/page.tsx`

- [ ] **Step 1: Write the collection endpoint**

`src/app/api/tasks/[id]/attachments/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

type Attachment = { id: string; name: string; description: string | null; type: string | null; url: string | null; taskId: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const list = await engineGet<Attachment[]>(`/task/${encodeURIComponent(id)}/attachment`);
    return Response.json(list);
  } catch (err) {
    return Response.json({ error: { status: 500, message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  // Pass the multipart body through verbatim; engine-rest accepts the same shape.
  const form = await req.formData();
  const out = new FormData();
  for (const [k, v] of form.entries()) out.append(k, v as Blob | string);
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/attachment/create`, {
    method: "POST",
    body: out,
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return Response.json(await res.json(), { status: 201 });
}
```

- [ ] **Step 2: Write the per-attachment endpoint**

`src/app/api/tasks/[id]/attachments/[attachmentId]/route.ts`:

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await params;
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/attachment/${encodeURIComponent(attachmentId)}/data`, {
    method: "GET",
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(res.body, {
    status: 200,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream" },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, attachmentId } = await params;
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/attachment/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Write the attachments card (server + client uploader)**

`src/app/(app)/tasklist/_components/task-attachments.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { AttachmentsList } from "./attachments-list";

type Attachment = { id: string; name: string; description: string | null; type: string | null; url: string | null; taskId: string };

async function load(taskId: string): Promise<Attachment[]> {
  try {
    return await engineGet<Attachment[]>(`/task/${encodeURIComponent(taskId)}/attachment`);
  } catch {
    return [];
  }
}

export async function TaskAttachments({ taskId }: { taskId: string }) {
  const list = await load(taskId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>Files and URLs linked to this task.</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentsList taskId={taskId} initial={list} />
      </CardContent>
    </Card>
  );
}
```

`attachments-list.tsx` (client child):

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Trash2 } from "lucide-react";

type Attachment = { id: string; name: string; description: string | null; type: string | null; url: string | null; taskId: string };

export function AttachmentsList({ taskId, initial }: { taskId: string; initial: Attachment[] }) {
  const [list, setList] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const upload = () => {
    if (!file && !name) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("attachment-name", name || file?.name || "untitled");
      if (file) fd.append("content", file);
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/attachments`, { method: "POST", body: fd });
      if (res.ok) {
        const created = (await res.json()) as Attachment;
        setList((prev) => [...prev, created]);
        setName("");
        setFile(null);
      }
    });
  };

  const remove = (a: Attachment) =>
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      if (res.ok) setList((prev) => prev.filter((x) => x.id !== a.id));
    });

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No attachments.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border p-2">
              <a href={`/api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(a.id)}`} className="flex items-center gap-2 text-sm hover:underline" download>
                <Paperclip className="size-4" /> {a.name}
              </a>
              <Button size="icon" variant="ghost" onClick={() => remove(a)} disabled={pending}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 border-t pt-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button onClick={upload} disabled={pending || (!file && !name)}>Upload</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount in detail page**

```tsx
import { TaskAttachments } from "../_components/task-attachments";
// ...
<TaskAttachments taskId={task.id} />
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/\[id\]/attachments src/app/\(app\)/tasklist/_components/task-attachments.tsx src/app/\(app\)/tasklist/_components/attachments-list.tsx src/app/\(app\)/tasklist/\[id\]/page.tsx
git commit -m "feat(tasklist): attachments list + upload + download + delete"
```

---

## Task 9: Saved filters — backing routes

**Files:**
- Create: `src/app/api/filters/route.ts`
- Create: `src/app/api/filters/[id]/route.ts`
- Create: `src/app/api/filters/[id]/list/route.ts`
- Create: `src/lib/tasklist/filter-url.ts`
- Create: `src/lib/tasklist/filter-url.test.ts`
- Create: `vitest.config.ts` (if absent)

- [ ] **Step 1: Write `src/app/api/filters/route.ts`**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { getSession } from "@/lib/auth/session";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

type FilterDto = {
  id: string;
  name: string;
  owner: string;
  resourceType: "Task";
  query: Record<string, unknown>;
  properties: Record<string, unknown>;
  itemCount: number | null;
};

export async function GET() {
  const session = await getSession();
  const owner = encodeURIComponent(session?.username ?? "");
  try {
    const list = await engineGet<FilterDto[]>(`/filter?resourceType=Task&owner=${owner}&itemCount=true`);
    return Response.json(list);
  } catch (err) {
    return Response.json({ error: { status: 500, message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const body = await req.json();
  const res = await engineFetch(`/filter/create`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return Response.json(await res.json(), { status: 201 });
}
```

- [ ] **Step 2: Write `[id]/route.ts` (GET/PUT/DELETE)**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await engineGet(`/filter/${encodeURIComponent(id)}`);
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: { status: 500, message: String(err) } }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const res = await engineFetch(`/filter/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/filter/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Write `[id]/list/route.ts`**

```ts
import { engineGet } from "@/lib/camunda/engine";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const qs = url.search ? url.search : "";
  try {
    const data = await engineGet(`/filter/${encodeURIComponent(id)}/list${qs}`);
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: { status: 500, message: String(err) } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write filter URL serialization helper + unit tests**

`src/lib/tasklist/filter-url.ts`:

```ts
export type TasklistFilter = {
  mode: "mine" | "claimable" | "all" | "saved";
  filterId?: string;
  sortBy?: "created" | "due" | "priority" | "followUp" | "name";
  sortOrder?: "asc" | "desc";
  page?: number;
};

const DEFAULT: TasklistFilter = { mode: "mine", sortBy: "created", sortOrder: "desc", page: 1 };

export function filterToParams(f: TasklistFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.mode && f.mode !== DEFAULT.mode) p.set("mode", f.mode);
  if (f.filterId) p.set("filterId", f.filterId);
  if (f.sortBy && f.sortBy !== DEFAULT.sortBy) p.set("sortBy", f.sortBy);
  if (f.sortOrder && f.sortOrder !== DEFAULT.sortOrder) p.set("sortOrder", f.sortOrder);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

export function paramsToFilter(p: URLSearchParams): TasklistFilter {
  const modeRaw = p.get("mode");
  const mode: TasklistFilter["mode"] =
    modeRaw === "claimable" || modeRaw === "all" || modeRaw === "saved" ? modeRaw : "mine";
  return {
    mode,
    filterId: p.get("filterId") ?? undefined,
    sortBy: (p.get("sortBy") as TasklistFilter["sortBy"]) ?? "created",
    sortOrder: (p.get("sortOrder") as TasklistFilter["sortOrder"]) ?? "desc",
    page: p.get("page") ? Math.max(1, Number.parseInt(p.get("page") ?? "1", 10)) : 1,
  };
}
```

`src/lib/tasklist/filter-url.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { filterToParams, paramsToFilter } from "./filter-url";

describe("filter-url", () => {
  test("roundtrips a saved filter selection", () => {
    const f = { mode: "saved" as const, filterId: "abc", sortBy: "due" as const, sortOrder: "asc" as const, page: 3 };
    const p = filterToParams(f);
    expect(paramsToFilter(p)).toEqual(f);
  });

  test("omits defaults from URL", () => {
    const p = filterToParams({ mode: "mine", sortBy: "created", sortOrder: "desc", page: 1 });
    expect(p.toString()).toBe("");
  });

  test("clamps page < 1 to 1", () => {
    const p = new URLSearchParams("page=-5");
    expect(paramsToFilter(p).page).toBe(1);
  });
});
```

- [ ] **Step 5: Add `vitest.config.ts` if missing**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

DevOps handoff: `npm install -D vitest vite-tsconfig-paths` if not installed.

- [ ] **Step 6: Run the unit tests**

DevOps handoff: `npx vitest run src/lib/tasklist/filter-url.test.ts`. Confirm 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/filters src/lib/tasklist vitest.config.ts package.json
git commit -m "feat(tasklist): filter CRUD route handlers + filter-url helper + tests"
```

---

## Task 10: Filter list (saved filters sidebar)

**Files:**
- Create: `src/app/(app)/tasklist/_components/filter-list.tsx`
- Modify: `src/app/(app)/tasklist/_components/filter-rail.tsx`
- Modify: `src/app/(app)/tasklist/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { engineGet } from "@/lib/camunda/engine";
import { getSession } from "@/lib/auth/session";

type FilterDto = { id: string; name: string; itemCount: number | null };

async function load(): Promise<FilterDto[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    return await engineGet<FilterDto[]>(`/filter?resourceType=Task&owner=${encodeURIComponent(session.username)}&itemCount=true`);
  } catch {
    return [];
  }
}

export async function FilterList({ activeFilterId }: { activeFilterId: string | null }) {
  const list = await load();
  if (list.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground px-2 text-xs font-medium uppercase tracking-wide">Saved filters</p>
      {list.map((f) => (
        <Link
          key={f.id}
          href={`/tasklist?mode=saved&filterId=${encodeURIComponent(f.id)}`}
          className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${activeFilterId === f.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
        >
          <span>{f.name}</span>
          {f.itemCount !== null ? <Badge variant="secondary">{f.itemCount}</Badge> : null}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `filter-rail.tsx` to include `FilterList`**

Add a `<FilterList activeFilterId={...} />` below the mode radio. Pass through from the page.

- [ ] **Step 3: Update `tasklist/page.tsx` to honour `?mode=saved&filterId=`**

When mode is `saved`, fetch `/filter/{id}/list?...` instead of `/task?...`. Adjust `buildQuery` and `safeTasks` accordingly.

```tsx
async function safeTasks(filter: TasklistFilter, username: string) {
  try {
    if (filter.mode === "saved" && filter.filterId) {
      const tasks = await engineGet<ListTask[]>(`/filter/${encodeURIComponent(filter.filterId)}/list?maxResults=100`);
      return { tasks, error: null };
    }
    const tasks = await engineGet<ListTask[]>(`/task?${buildLegacyQuery(filter, username)}`);
    return { tasks, error: null };
  } catch (err) {
    return { tasks: null, error: err instanceof Error ? err.message : "Engine unreachable" };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/tasklist/_components/filter-list.tsx src/app/\(app\)/tasklist/_components/filter-rail.tsx src/app/\(app\)/tasklist/page.tsx
git commit -m "feat(tasklist): saved filters sidebar + route through filter/{id}/list"
```

---

## Task 11: Filter editor modal

**Files:**
- Create: `src/app/(app)/tasklist/_components/filter-editor.tsx`
- Modify: `src/app/(app)/tasklist/_components/filter-rail.tsx` (mount the trigger button)

- [ ] **Step 1: Build the editor**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Editing = {
  id?: string;
  name: string;
  query: { assignee?: string; candidateGroup?: string; processVariables?: Array<{ name: string; operator: string; value: string }> };
  properties: { color?: string; description?: string; priority?: number };
};

const EMPTY: Editing = { name: "", query: {}, properties: {} };

export function FilterEditor({ existing }: { existing?: Editing }) {
  const [draft, setDraft] = useState<Editing>(existing ?? EMPTY);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const url = draft.id ? `/api/filters/${encodeURIComponent(draft.id)}` : `/api/filters`;
      const method = draft.id ? "PUT" : "POST";
      const payload = { name: draft.name, resourceType: "Task", query: draft.query, properties: draft.properties };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        setOpen(false);
        // Force a server refresh so the new filter shows in the sidebar.
        if (typeof window !== "undefined") window.location.reload();
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{existing ? "Edit filter" : "New filter"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit filter" : "Create filter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>Assignee</Label>
            <Input value={draft.query.assignee ?? ""} onChange={(e) => setDraft({ ...draft, query: { ...draft.query, assignee: e.target.value || undefined } })} />
          </div>
          <div>
            <Label>Candidate group</Label>
            <Input value={draft.query.candidateGroup ?? ""} onChange={(e) => setDraft({ ...draft, query: { ...draft.query, candidateGroup: e.target.value || undefined } })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={draft.properties.description ?? ""} onChange={(e) => setDraft({ ...draft, properties: { ...draft.properties, description: e.target.value } })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || !draft.name.trim()}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Mount the "New filter" button in `filter-rail.tsx`**

Right above the saved-filter list.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/tasklist/_components/filter-editor.tsx src/app/\(app\)/tasklist/_components/filter-rail.tsx
git commit -m "feat(tasklist): filter editor modal (create/edit)"
```

---

## Task 12: Sort control + pagination

**Files:**
- Create: `src/app/(app)/tasklist/_components/sort-control.tsx`
- Modify: `src/app/(app)/tasklist/page.tsx` (consume new search params)
- Modify: `src/app/(app)/tasklist/_components/workspace.tsx` (header slot for sort)

- [ ] **Step 1: Write the sort control**

```tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = [
  { value: "created:desc", label: "Newest first" },
  { value: "created:asc", label: "Oldest first" },
  { value: "due:asc", label: "Due date ↑" },
  { value: "due:desc", label: "Due date ↓" },
  { value: "priority:desc", label: "Priority ↓" },
  { value: "name:asc", label: "Name A–Z" },
];

export function SortControl({ sortBy, sortOrder }: { sortBy: string; sortOrder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current = `${sortBy}:${sortOrder}`;
  const onChange = (v: string) => {
    const [by, order] = v.split(":");
    const next = new URLSearchParams(params);
    next.set("sortBy", by);
    next.set("sortOrder", order);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Consume sort + page in `tasklist/page.tsx`**

Replace the existing `buildQuery` with `filterToParams`-driven logic; thread `sortBy`/`sortOrder`/`firstResult`/`maxResults` (page-size 25) into the `engine-rest/task` query string.

- [ ] **Step 3: Add pagination footer to `task-cards.tsx`**

If task count equals maxResults, show "Next page" button writing `?page=N+1`. If page > 1, show "Previous page". Use `<Link>` from next/link (no client state needed).

- [ ] **Step 4: Mount `<SortControl />` in `workspace.tsx` header slot**

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tasklist
git commit -m "feat(tasklist): sort dropdown + pagination footer"
```

---

## Task 13: Keyboard shortcuts

**Files:**
- Create: `src/app/(app)/tasklist/_components/keyboard-shortcuts.tsx`
- Modify: `src/app/(app)/tasklist/page.tsx` (mount once)

- [ ] **Step 1: Build the keydown handler**

```tsx
"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const SHORTCUTS = `
j/k — next/previous task
c — claim selected
x — complete selected
/ — focus search
?- this help (hold shift+/)
`;

export function KeyboardShortcuts({ taskIds }: { taskIds: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when an input is focused.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;

      const current = params.get("taskId");
      const idx = current ? taskIds.indexOf(current) : -1;

      if (e.key === "j") {
        const next = taskIds[idx + 1] ?? taskIds[0];
        if (next) {
          const p = new URLSearchParams(params);
          p.set("taskId", next);
          router.push(`${pathname}?${p.toString()}`);
        }
      } else if (e.key === "k") {
        const prev = taskIds[idx - 1] ?? taskIds[taskIds.length - 1];
        if (prev) {
          const p = new URLSearchParams(params);
          p.set("taskId", prev);
          router.push(`${pathname}?${p.toString()}`);
        }
      } else if (e.key === "?") {
        alert(SHORTCUTS);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [taskIds, params, pathname, router]);

  return null;
}
```

- [ ] **Step 2: Mount in `tasklist/page.tsx`**

```tsx
<KeyboardShortcuts taskIds={(tasks ?? []).map((t) => t.id)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/tasklist/_components/keyboard-shortcuts.tsx src/app/\(app\)/tasklist/page.tsx
git commit -m "feat(tasklist): keyboard shortcuts (j/k navigation, ? help)"
```

---

## Task 14: Plugin — tasklist-sorting

**Files:**
- Create: `plugins/tasklist-sorting/plugin.json`
- Create: `plugins/tasklist-sorting/client.tsx`
- Modify: `src/lib/plugins/registry.ts` (add to hand-maintained index)
- Modify: `src/app/(app)/tasklist/_components/workspace.tsx` (insert `<ExtensionSlot point="tasklist.list" />` next to the SortControl)

- [ ] **Step 1: Write the manifest**

```json
{
  "id": "tasklist-sorting",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "tasklist.list", "exportName": "AdvancedSortMenu", "priority": 50 }
    ]
  }
}
```

- [ ] **Step 2: Write the client component**

```tsx
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

const ADVANCED = [
  { sortBy: "followUp", sortOrder: "asc", label: "Follow-up date ↑" },
  { sortBy: "priority", sortOrder: "asc", label: "Priority ↑" },
  { sortBy: "name", sortOrder: "desc", label: "Name Z–A" },
];

export function AdvancedSortMenu() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const apply = (sortBy: string, sortOrder: string) => {
    const next = new URLSearchParams(params);
    next.set("sortBy", sortBy);
    next.set("sortOrder", sortOrder);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Advanced sort">
          <SlidersHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {ADVANCED.map((o) => (
          <DropdownMenuItem key={`${o.sortBy}:${o.sortOrder}`} onSelect={() => apply(o.sortBy, o.sortOrder)}>{o.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Register in `src/lib/plugins/registry.ts`**

```ts
import sortingManifest from "@/../plugins/tasklist-sorting/plugin.json";
import * as sortingClient from "@/../plugins/tasklist-sorting/client";

export const PLUGINS: RegisteredPlugin[] = [
  // ...existing
  { manifest: sortingManifest as PluginManifest, clientExports: sortingClient as unknown as RegisteredPlugin["clientExports"] },
];
```

- [ ] **Step 4: Mount slot host**

In `workspace.tsx` header, next to `<SortControl />`:

```tsx
import { ExtensionSlot } from "@/lib/plugins/extension-slot";
// ...
<ExtensionSlot point="tasklist.list" />
```

- [ ] **Step 5: Commit**

```bash
git add plugins/tasklist-sorting src/lib/plugins/registry.ts src/app/\(app\)/tasklist/_components/workspace.tsx
git commit -m "feat(plugin): tasklist-sorting (advanced sort menu via tasklist.list slot)"
```

---

## Task 15: Plugin — tasklist-card

**Files:**
- Create: `plugins/tasklist-card/plugin.json`
- Create: `plugins/tasklist-card/client.tsx`
- Modify: `src/lib/plugins/registry.ts`
- Modify: `src/app/(app)/tasklist/_components/task-cards.tsx` (insert `<ExtensionSlot point="tasklist.card" props={{ task }} />`)

- [ ] **Step 1: Manifest**

```json
{
  "id": "tasklist-card",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "tasklist.card", "exportName": "TaskCardExtras", "priority": 100 }
    ]
  }
}
```

- [ ] **Step 2: Client component**

```tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

type Task = { id: string; due: string | null; followUp: string | null; processDefinitionId: string | null; priority: number };

export function TaskCardExtras({ task }: { task: Task }) {
  const overdue = task.due && new Date(task.due) < new Date();
  return (
    <div className="flex flex-wrap gap-2 pt-1 text-xs">
      {overdue ? <Badge variant="destructive" className="gap-1"><AlertCircle className="size-3" /> Overdue</Badge> : null}
      {task.priority >= 75 ? <Badge variant="secondary">High priority</Badge> : null}
      {task.processDefinitionId ? <code className="bg-muted rounded px-1">{task.processDefinitionId.split(":")[0]}</code> : null}
    </div>
  );
}
```

- [ ] **Step 3: Register + mount slot**

Add to `registry.ts`. In `task-cards.tsx`, inside each card body (after the existing rows): `<ExtensionSlot point="tasklist.card" props={{ task }} />`.

- [ ] **Step 4: Commit**

```bash
git add plugins/tasklist-card src/lib/plugins/registry.ts src/app/\(app\)/tasklist/_components/task-cards.tsx
git commit -m "feat(plugin): tasklist-card (overdue/priority/process key badges)"
```

---

## Task 16: Plugin — tasklist-standalone-task (+ create endpoint)

**Files:**
- Create: `plugins/tasklist-standalone-task/plugin.json`
- Create: `plugins/tasklist-standalone-task/client.tsx`
- Create: `plugins/tasklist-standalone-task/server.ts`
- Create: `src/app/api/plugin/tasklist-standalone-task/create/route.ts`
- Modify: `src/lib/plugins/registry.ts`
- Modify: `src/components/app-shell/topbar.tsx` (or wherever the navbar action area lives) — mount `<ExtensionSlot point="tasklist.navbar.action" />` scoped to `/tasklist` routes

- [ ] **Step 1: Manifest**

```json
{
  "id": "tasklist-standalone-task",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "tasklist.navbar.action", "exportName": "StandaloneTaskButton", "priority": 100 }
    ]
  }
}
```

- [ ] **Step 2: Server handler**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { getSession } from "@/lib/auth/session";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const session = await getSession();
  if (!session) return Response.json({ error: { status: 401, message: "unauthenticated" } }, { status: 401 });
  const body = (await req.json()) as { name: string; description?: string; assignee?: string; due?: string };
  if (!body.name?.trim()) return Response.json({ error: { status: 400, message: "name required" } }, { status: 400 });
  const res = await engineFetch(`/task/create`, {
    method: "POST",
    body: JSON.stringify({
      name: body.name.trim(),
      description: body.description ?? null,
      assignee: body.assignee ?? session.username,
      due: body.due ?? null,
      priority: 50,
    }),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Client component**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function StandaloneTaskButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/plugin/tasklist-standalone-task/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default"><Plus className="mr-1 size-4" /> New task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create standalone task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={pending || !name.trim()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Register + mount slot**

`registry.ts`: add the manifest entry. The slot host: find the existing top-bar component (likely under `src/components/app-shell/`); read it, then add `<ExtensionSlot point="tasklist.navbar.action" />` conditional on the route starting with `/tasklist`.

If no app-shell top-bar exists yet, mount the slot inline at the top of `tasklist/page.tsx` as a `<header className="flex justify-end">`.

- [ ] **Step 5: Test manually**

DevOps handoff: open `/tasklist`. Click "New task". Fill name. Confirm a task appears assigned to demo. Refresh — visible in the inbox.

- [ ] **Step 6: Commit**

```bash
git add plugins/tasklist-standalone-task src/app/api/plugin/tasklist-standalone-task src/lib/plugins/registry.ts
git commit -m "feat(plugin): tasklist-standalone-task (create user task via navbar slot)"
```

---

## Task 17: Resolve delegation + assignee submenu (task-actions extension)

**Files:**
- Create: `src/app/api/tasks/[id]/resolve/route.ts`
- Modify: `src/app/(app)/tasklist/_components/task-actions.tsx`

- [ ] **Step 1: Write the resolve endpoint**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ variables: body.variables ?? {} }),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Extend task-actions.tsx**

Read existing file. Add:
- Assign-to-user dropdown (calls `/api/tasks/[id]/assignee` with `{ userId: target }`).
- Resolve button (visible only if `task.delegationState === "PENDING"` — pass this via props).

Code skeleton:

```tsx
"use client";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus } from "lucide-react";

export function AssignSubmenu({ taskId, onDone }: { taskId: string; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState("");
  const assign = () =>
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/assignee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: val }),
      });
      if (res.ok) { setVal(""); onDone?.(); }
    });
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="sm"><UserPlus className="mr-1 size-4" /> Assign</Button></PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="user id" />
        <Button onClick={assign} disabled={pending || !val.trim()} className="w-full">Assign</Button>
      </PopoverContent>
    </Popover>
  );
}
```

Wire it into the existing actions row.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/\[id\]/resolve src/app/\(app\)/tasklist/_components/task-actions.tsx
git commit -m "feat(tasklist): resolve delegation + assign-to-user submenu"
```

---

## Task 18: Playwright fixture — deploy test process + form

**Files:**
- Create: `e2e/_fixtures/test-process.bpmn`
- Create: `e2e/_fixtures/test-form.form`
- Create: `e2e/_fixtures/deploy.ts`
- Modify: `e2e/_fixtures.ts` (or `playwright.config.ts`) — call `deployTestArtifacts()` in `globalSetup`

- [ ] **Step 1: Write `test-process.bpmn`**

Minimal BPMN 2.0 XML with one user task (`reviewTask`) referencing form key `camunda-forms:deployment:test-form.form`. Use a known process key `TestReview`.

(Inline XML provided as a string in the file — see legacy `webapps/frontend/ui/cockpit/tests/...` if a reference is needed; otherwise hand-roll a minimal valid file with `bpmn:process id="TestReview"` plus one `bpmn:userTask id="reviewTask" camunda:formKey="camunda-forms:deployment:test-form.form"`.)

- [ ] **Step 2: Write `test-form.form`**

A form-js JSON schema with a single textfield `comment` and a submit button.

```json
{
  "type": "default",
  "schemaVersion": 16,
  "exporter": { "name": "form-js (test fixture)", "version": "1.4.0" },
  "components": [
    { "type": "textfield", "key": "comment", "label": "Comment" }
  ]
}
```

- [ ] **Step 3: Write `deploy.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENGINE = process.env.CAMUNDA_E2E_ENGINE ?? "http://localhost:8080/engine-rest";

export async function deployTestArtifacts() {
  const bpmn = readFileSync(resolve(__dirname, "test-process.bpmn"));
  const form = readFileSync(resolve(__dirname, "test-form.form"));
  const fd = new FormData();
  fd.append("deployment-name", "phase-2-e2e-fixture");
  fd.append("enable-duplicate-filtering", "true");
  fd.append("test-process.bpmn", new Blob([bpmn], { type: "application/xml" }), "test-process.bpmn");
  fd.append("test-form.form", new Blob([form], { type: "application/json" }), "test-form.form");

  const auth = Buffer.from("demo:demo").toString("base64");
  const res = await fetch(`${ENGINE}/deployment/create`, { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
  if (!res.ok) throw new Error(`Test deploy failed: ${res.status}`);
}
```

- [ ] **Step 4: Wire into `playwright.config.ts`**

Add `globalSetup: "./e2e/_fixtures/global-setup.ts"`; the global setup imports and awaits `deployTestArtifacts()`.

- [ ] **Step 5: Commit**

```bash
git add e2e/_fixtures playwright.config.ts
git commit -m "test(tasklist): Playwright global setup deploys test process + form"
```

---

## Task 19: E2E — claim & complete (no form)

**Files:**
- Create: `e2e/tasklist-claim-complete.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-2 tasklist claim+complete", () => {
  test("claim a candidate-group task and complete without a form", async ({ page, request }) => {
    // Start a process instance via engine-rest.
    const auth = { username: "demo", password: "demo" };
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-${Date.now()}` },
      headers: { Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}` },
    });
    expect(start.ok()).toBe(true);

    await loginAs(page, "demo", "demo");
    await page.goto("/tasklist?mode=all");
    await expect(page.getByRole("heading", { name: /tasklist/i })).toBeVisible();

    const firstRow = page.getByRole("link", { name: /review/i }).first();
    await firstRow.click();

    await page.getByRole("button", { name: /claim/i }).click();
    await expect(page.getByText("demo")).toBeVisible();

    // The test process's task has a form, so use the "Complete" button on the action bar
    // which writes only the action without form vars (legacy parity).
    await page.getByRole("button", { name: /complete task/i }).click();

    await expect(page.getByText(/back to inbox/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

DevOps handoff: `npx playwright test e2e/tasklist-claim-complete.spec.ts --project=chromium`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tasklist-claim-complete.spec.ts
git commit -m "test(tasklist): @phase-2 claim+complete e2e"
```

---

## Task 20: E2E — form-driven complete

**Files:**
- Create: `e2e/tasklist-form-complete.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-2 tasklist form complete", () => {
  test("complete with form-js renderer + variable round-trip", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-form-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    expect(start.ok()).toBe(true);

    await loginAs(page, "demo", "demo");
    await page.goto("/tasklist?mode=all");
    await page.getByRole("link", { name: /review/i }).first().click();
    await page.getByRole("button", { name: /claim/i }).click();

    await page.getByLabel("Comment").fill("Looks good");
    await page.getByRole("button", { name: /complete task/i }).click();
    await expect(page).toHaveURL(/\/tasklist/);

    // Verify the variable was persisted via history.
    const hist = await request.get("http://localhost:8080/engine-rest/history/variable-instance?variableName=comment&sortBy=name&sortOrder=asc", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const body = (await hist.json()) as Array<{ value: string }>;
    expect(body.some((v) => v.value === "Looks good")).toBe(true);
  });
});
```

- [ ] **Step 2: Run + commit**

DevOps: `npx playwright test e2e/tasklist-form-complete.spec.ts`.

```bash
git add e2e/tasklist-form-complete.spec.ts
git commit -m "test(tasklist): @phase-2 form-driven complete e2e"
```

---

## Task 21: E2E — filters

**Files:**
- Create: `e2e/tasklist-filters.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-2 tasklist filters", () => {
  test("create, switch, sort, paginate", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    await page.goto("/tasklist");

    await page.getByRole("button", { name: /new filter/i }).click();
    await page.getByLabel("Name").fill("Phase-2 e2e filter");
    await page.getByLabel("Assignee").fill("demo");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText("Phase-2 e2e filter")).toBeVisible({ timeout: 10_000 });
    await page.getByText("Phase-2 e2e filter").click();

    await expect(page).toHaveURL(/mode=saved/);

    // Sort
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /name a–z/i }).click();
    await expect(page).toHaveURL(/sortBy=name/);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
git add e2e/tasklist-filters.spec.ts
git commit -m "test(tasklist): @phase-2 filters e2e"
```

---

## Task 22: E2E — comments + attachments

**Files:**
- Create: `e2e/tasklist-comments-attachments.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-2 comments + attachments", () => {
  test("add a comment, upload an attachment, delete it", async ({ page, request }) => {
    const auth = Buffer.from("demo:demo").toString("base64");
    const start = await request.post("http://localhost:8080/engine-rest/process-definition/key/TestReview/start", {
      data: { businessKey: `e2e-comm-${Date.now()}` },
      headers: { Authorization: `Basic ${auth}` },
    });
    expect(start.ok()).toBe(true);

    await loginAs(page, "demo", "demo");
    await page.goto("/tasklist?mode=all");
    await page.getByRole("link", { name: /review/i }).first().click();

    await page.getByPlaceholder("Add a comment").fill("Hello from e2e");
    await page.getByRole("button", { name: /post/i }).click();
    await expect(page.getByText("Hello from e2e")).toBeVisible();

    await page.getByPlaceholder("Name (optional)").fill("e2e.txt");
    await page.setInputFiles('input[type="file"]', { name: "e2e.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await page.getByRole("button", { name: /upload/i }).click();
    await expect(page.getByText("e2e.txt")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tasklist-comments-attachments.spec.ts
git commit -m "test(tasklist): @phase-2 comments + attachments e2e"
```

---

## Task 23: E2E — standalone task plugin

**Files:**
- Create: `e2e/tasklist-standalone-task.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-2 standalone task plugin", () => {
  test("create a standalone task; appears in inbox", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    await page.goto("/tasklist");

    await page.getByRole("button", { name: /new task/i }).click();
    const name = `Standalone ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: /create/i }).click();

    await page.goto("/tasklist");
    await expect(page.getByText(name)).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tasklist-standalone-task.spec.ts
git commit -m "test(tasklist): @phase-2 standalone task plugin e2e"
```

---

## Task 24: Run the full @phase-2 suite

**Files:** none (DevOps handoff)

- [ ] **Step 1: Run Playwright with `@phase-2` grep**

DevOps handoff: `npx playwright test --grep @phase-2 --project=chromium,firefox,webkit`.

- [ ] **Step 2: If any test red, file a follow-up task; do not paper over**

- [ ] **Step 3: Capture screenshots evidence**

```
docs/superpowers/specs/evidence/phase-2/
  ├── inbox.png
  ├── task-detail.png
  ├── form-complete.png
  ├── filter-editor.png
  └── attachments.png
```

DevOps handoff (or manual capture during dev server).

- [ ] **Step 4: Commit evidence**

```bash
git add docs/superpowers/specs/evidence/phase-2
git commit -m "docs(phase-2): manual smoke screenshots"
```

---

## Task 25: Phase 2 exit checklist

**Files:** none (process gate)

- [ ] **Step 1: Walk roadmap §4.2**

Every row marked ⬜ in the inventory must now be ✅ or 🚫. Verify each:

| §4.2 row | Resolution |
|---|---|
| Claim/unclaim | ✅ (existing routes + Task 2 hardening) |
| Complete | ✅ (Task 5 form-js + existing route) |
| Form rendering | ✅ (Task 5) |
| Variables editor | ✅ (Task 6) |
| Identity links | ✅ (Task 3) |
| Task comments | ✅ (existing + Task 2 hardening) |
| Task history | ✅ (Task 7) |
| Task attachments | ✅ (Task 8) |
| Filters (saved, candidate-group, search) | ✅ (Task 9–11) |
| Filter editor modal | ✅ (Task 11) |
| Sort controls | ✅ (Task 12 + Task 14 plugin) |
| Tasklist card plugin | ✅ (Task 15) |
| Standalone task creation | ✅ (Task 16) |
| Keyboard shortcuts | ✅ (Task 13) |
| Navigation (multi-engine) | ✅ (Phase 0 selector); per-tasklist nav: 🚫 dropped (no Tasklist-specific engine deep-links in legacy parity scope) |

- [ ] **Step 2: Distro routing flip**

DevOps handoff: update `distro/run/distro/src/main/resources/proxy-config.yml` (or equivalent) so `/camunda/app/tasklist/*` routes to Next under `--ui both`. Re-run smoke.

- [ ] **Step 3: Final exit commit**

```bash
git commit --allow-empty -m "phase-2: tasklist cutover exit — all §4.2 rows shipped"
```

- [ ] **Step 4: Update the roadmap inventory**

In `docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` §4.2, change every ⬜ to ✅ (or 🚫 with the rationale above). Commit separately.
