# Welcome + Tasklist pages — design

**Date:** 2026-05-21
**Scope:** `webapps-next/`
**Status:** Approved (pending spec review)

## Summary

Add two server-rendered pages to the Next.js rewrite, completing the app-launcher navigation that the existing landing implies:

- `src/app/(app)/welcome/page.tsx` — personalized launcher (greeting, at-a-glance task counts, three app cards).
- `src/app/(app)/tasklist/page.tsx` — read-only inbox of the current user's open tasks.

Both pages follow the established cockpit-page pattern in the same scaffold (server component, `engineGet<T>`, `getSession`, graceful "Engine unreachable" fallback). No new dependencies. No new abstractions beyond a `TaskDto` type alias.

Claim / complete / forms / filters / pagination / task detail are explicitly **deferred** to a follow-up phase.

## Existing scaffold (relied on as-is)

These are the building blocks already present; this spec does not change them.

- `src/lib/camunda/engine.ts` — `engineGet<T>(path)` for engine-rest reads (via `/api/engine/*` rewrite to `CAMUNDA_ENGINE_REST_URL`); `identityVerify(...)` for auth.
- `src/lib/auth/session.ts` — `getSession()` returns `{ username: string }` from the signed cookie; `encodeSession` / `sessionCookieOptions` for the login route.
- `src/proxy.ts` — middleware that redirects unauthenticated traffic to `/login`.
- `src/app/(app)/layout.tsx` — sidebar shell (`SidebarProvider` + `AppSidebar` + `SidebarInset`); session-gated; `redirect("/login")` on missing session.
- `src/app/(app)/cockpit/page.tsx` — **canonical pattern** to mirror (server component, `Promise.all`, `safeCount`, shadcn `Card`).
- `src/components/ui/*` — full shadcn primitives, including `card`, `table`, `button`, `badge`.
- `src/components/app-shell/nav-items.ts` — sidebar nav definitions (verify Welcome + Tasklist entries; add if missing).

## Architecture

Both new pages are **React Server Components** under the existing `(app)` route group, so they inherit the sidebar shell and auth gate automatically.

Data flow per page:

```
async function Page()
  ├─ session = await getSession()
  ├─ data = await Promise.all([ engineGet(...), engineGet(...) ])  // wrapped in safeFetch helpers
  └─ render shadcn components with values or "—" + caption on null
```

Every engine call goes through a `safe*` helper that returns `null` on any error; the renderer turns `null` into a muted "Engine unreachable" caption — same convention as `cockpit/page.tsx:8-15`.

No client components are introduced in v1. Future claim/complete will need `"use client"` action handlers, but they are out of scope here.

## Welcome page

**Path:** `src/app/(app)/welcome/page.tsx`

### Layout

1. Heading block
   - `<h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>`
   - `<p className="text-muted-foreground text-sm">Camunda Platform</p>`
2. Stats row — `grid gap-4 md:grid-cols-2`
   - **Your open tasks** — count of `/task` where assignee = current user.
   - **All open tasks** — total count across the engine.
3. App launcher — `grid gap-4 md:grid-cols-3`, three Card components each wrapped in `next/link`'s `<Link>`:
   - **Cockpit** → `/cockpit` — Lucide `Workflow`, copy "Process & decision administration"
   - **Tasklist** → `/tasklist` — Lucide `ClipboardList`, copy "User task inbox"
   - **Admin** → `/admin` — Lucide `Users`, copy "Users, groups, authorizations"
   - Hover state: `hover:border-primary/40 transition-colors`

### Engine endpoints

| Purpose | Method + path |
|---|---|
| Your open task count | `GET /task/count?assignee={username}` |
| Total open task count | `GET /task/count` |

`username` comes from `await getSession()` — already URL-safe (alphanumeric + a small set in Camunda), but URL-encode defensively.

### Component shape

Local helper (file-private):

```ts
async function safeCount(path: string): Promise<number | null> {
  try { return (await engineGet<{ count: number }>(path)).count; }
  catch { return null; }
}
```

Same shape as `cockpit/page.tsx:8-15`.

## Tasklist page

**Path:** `src/app/(app)/tasklist/page.tsx`

### Layout

1. Heading block
   - `<h1>Tasklist</h1>` + subtitle "Your open user tasks"
2. Filter indicator — a single shadcn `Badge` showing `Assignee: {username}` (visual only; no interaction in v1, anchors the spot where a future filter control lives).
3. Task table — shadcn `Table` primitive.

### Columns

| Column | Source field | Render |
|---|---|---|
| Name | `task.name` | text |
| Process | `task.processDefinitionId` | first segment before `:` (e.g. `invoice:1:abc` → `invoice`) |
| Created | `task.created` (ISO string) | `formatDistanceToNow(date) + " ago"` via `date-fns` |
| Due | `task.due` (ISO or null) | absolute date or `"—"` |
| Priority | `task.priority` (number) | text |
| Action | — | `<Button variant="outline" size="sm" disabled>Open</Button>` (stub) |

### Endpoint

```
GET /task?assignee={username}&sortBy=created&sortOrder=desc&maxResults=50
```

### States

Header + filter pill always render. The body below them is one of:

- **Engine unreachable** (fetch throws): a centered muted message "Engine unreachable" replacing the table.
- **Empty list** (200, `[]`): a centered muted message "No tasks assigned to you." replacing the table.
- **Happy path:** the table with the columns described above.

The empty- and error-state renderers share the same shell (centered text in a muted block) — only the copy differs.

### Type

Define inline in the file for v1; promote to `src/lib/camunda/tasks.ts` when claim/complete arrives in a follow-up phase.

```ts
type TaskDto = {
  id: string;
  name: string;
  assignee: string | null;
  created: string;          // ISO 8601
  due: string | null;       // ISO 8601 or null
  followUp: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
};
```

The full Camunda `TaskDto` has additional fields (`delegationState`, `caseInstanceId`, `parentTaskId`, `tenantId`, etc.); v1 only references the subset listed. BE confirms these names + nullability on `GET /task` (see Cross-repo confirmations).

## Cross-repo confirmations needed before merge

These are **handoffs to the BE agent**; no Java code change expected, only confirmation against `engine-rest` source:

1. `GET /task` returns an array of objects with fields exactly named `id`, `name`, `assignee`, `created`, `due`, `followUp`, `priority`, `processDefinitionId`, `processInstanceId` (case + spelling).
2. `GET /task/count` accepts `assignee=` as a query param with the same matching semantics as `/task?assignee=`.
3. None of these endpoints require special headers beyond the standard auth (cookie/Basic). The earlier liveness check showed `/version` works without auth on the dev distro, but auth filter behavior on `/task` is config-dependent — confirm.

## DevOps handoffs

- After FE writes the two pages, restart the Next.js dev server (or rely on hot reload; either is fine for new App Router files).
- No backend rebuild required — read-only consumption of existing engine-rest endpoints.

## File list (net-new or modified)

**Net-new:**
- `webapps-next/src/app/(app)/welcome/page.tsx`
- `webapps-next/src/app/(app)/tasklist/page.tsx`

**Modified (only if absent):**
- `webapps-next/src/components/app-shell/nav-items.ts` — add Welcome and Tasklist nav entries if not already present.

**Not touched in this phase:**
- `src/lib/camunda/engine.ts` (the existing client is sufficient)
- `src/lib/auth/session.ts`
- `src/proxy.ts`
- `(app)/layout.tsx`
- Any existing shadcn primitive

## Out of scope (deferred to follow-up phases)

- Task detail page `/tasklist/[id]`
- Claim / unclaim / complete actions (would introduce POST routes + client mutations)
- Form rendering via `@bpmn-io/form-js` (already a dep; not used yet)
- Filters / saved filters / sort / search UI
- Pagination (`maxResults` is hardcoded to 50; v1 silently truncates beyond that)
- i18n via `next-intl` (English-only strings inline; migration target for legacy `locales/{en,de}.json` is a separate phase)
- Charts / process activity widgets on Welcome
- Candidate-user / candidate-group task scoping ("claimable" tab)

## Open questions

None blocking. Tasklist default scope (`assignee = current user`) is locked; "claimable tasks" view is in the deferred list.
