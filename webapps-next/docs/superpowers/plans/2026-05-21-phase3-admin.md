# Phase 3 — Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every ⬜ row in roadmap §4.3 so `/camunda/app/admin` can flip to webapps-next per Phase 3 exit criteria — user create/edit (profile, password, groups), group create/edit/membership, tenant CRUD + memberships, authorization create/delete-confirm, system info, system settings (telemetry + display), diagnostics (server info + license state *display* + telemetry), execution metrics, setup wizard, the `admin-base` plugin.

**Architecture:** Server components by default per §3.5; CRUD mutations via `/api/admin/*` route handlers proxying `engine-rest/{user,group,tenant,authorization,...}`; setup wizard + metrics target the webapp-rest module via `/api/admin/setup/...` and `/api/admin/plugin/adminPlugins/...` rewrites; admin-base plugin registers into `admin.dashboard.section` and `admin.system` slots; no NextAuth, no Spring proxied session — cookie session from Phase 0 carries `groups[]` for client-side action gating.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, Playwright, Vitest.

**Spec / inventory:** [`docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md`](../specs/2026-05-21-webapps-migration-roadmap-design.md) §4.3 + §5.2 + §6.

**Preconditions (must be merged before this plan executes):**
- Phase 0a — `webapps/webapp-rest/` module split (so `/api/admin/setup/...` and `/api/admin/plugin/adminPlugins/...` resolve)
- Phase 0b — plugin registry codegen
- Phase 0d — distro launcher `--ui` flag
- Phase 0f — `next-intl` i18n migration
- Phase 0g — Maven/npm/Playwright wiring
- Phase 0 — proxy + multi-engine + auth (CSRF, `groups[]` claim, `engine` claim)
- Phase 2 — tasklist completion (so the admin app shell + nav are stable downstream of any shared changes)

---

## Constraints binding this plan

- **Orchestrator must NOT auto-commit.** Per the user's global instructions, commits below run only on explicit "commit." Default: stop after each task, summarize the diff, wait.
- **Camunda formation roles:**
  - **FE agent** owns every file under `webapps-next/src/**`, `webapps-next/e2e/**`, `webapps-next/plugins/**`.
  - **BE agent** is invoked only for Task 0 (DTO confirmation). The webapp-rest endpoints `/api/admin/setup/{engine}/user/create` and `/api/admin/plugin/adminPlugins/{engine}/metrics/aggregated` must already exist post-Phase-0a; this plan does NOT change Java.
  - **DevOps agent** runs every `npm`, `npx playwright`, and Maven command.
- **Public API change rule (CLAUDE.md §6):** No JAX-RS signature changes. If a required field is missing on an existing DTO, stop and dispatch BE to discuss, do not widen the contract.
- **Q2 boundary (license install dropped):** No UI surface for installing a license key. Telemetry settings + display settings + license-state *display* in diagnostics stay.
- **Q3 boundary (setup wizard kept):** Strict parity. Single form posting to `/api/admin/setup/{engine}/user/create`.
- **Engine prerequisite:** Camunda Run on `localhost:8080`, fresh database for setup-wizard e2e (or a runtime toggle that resets `org.camunda.bpm.admin.setup` state). Default admin `demo`/`demo` for non-setup tests.
- **`use client` discipline (§3.5):** Page files server-rendered; forms/dialogs/editors in `_components/*.tsx` with `"use client"`.
- **Existing in-progress files:** Reconcile, don't rewrite (see Task 1).

---

## Layout, Component & Typography Spec

Every page in this plan inherits the conventions below. Don't redefine inline — reference back here.

### Typography scale (Tailwind classes)

| Token | Class | When |
|---|---|---|
| `display` | `text-3xl font-semibold` | Stat counters (user count, group count). |
| `h1` page title | `text-2xl font-semibold tracking-tight` | One per page; followed by a `text-muted-foreground text-sm` subtitle. |
| `h2` section | `text-lg font-semibold` | Outside-Card section headers; inside cards use `<CardTitle>`. |
| `h3` subsection | `text-sm font-medium` | Stat-card titles, form section labels. |
| `body-muted` | `text-muted-foreground text-sm` | Subtitles, descriptions, empty-state text. |
| `caption` | `text-xs text-muted-foreground` | Help text under inputs, timestamps. |
| `code` inline | `bg-muted rounded px-1 text-xs font-mono` | User/group/tenant IDs, REST paths. |
| `code` block | `bg-muted text-muted-foreground rounded p-3 text-xs font-mono` | Diagnostic dumps (`/version`, engine config). |

### Spacing scale

- Page vertical rhythm: `space-y-6`.
- Header block: `space-y-1` (title + subtitle) inside `flex items-end justify-between` row.
- Card grid: `gap-4 md:grid-cols-2 lg:grid-cols-4` for stat cards; `gap-4 md:grid-cols-2` for half-width sections; single column otherwise.
- Form field stack: `space-y-3`; each field `<div className="space-y-1.5"><Label/><Input/><caption/></div>`.
- Form section divider: `border-t pt-4 mt-4`.
- Inline action row: `flex gap-2`.
- Table inside Card: `<CardContent className="p-0">` then `<Table>`.

### Color tokens (semantic, never raw)

- Default: `text-foreground` (implicit).
- Muted: `text-muted-foreground`.
- Destructive: `text-destructive`, `variant="destructive"` on Badge/Button (delete confirms, auth-deny entries).
- Warning (telemetry off in a prod-tagged distro): `tone="warning"` pattern from `cockpit/page.tsx:80` (`text-destructive` only when value > 0).
- Surface tint: `bg-muted`.
- Card hover (clickable rows): `hover:border-primary/40 transition-colors`.

### Layout grid

**Admin dashboard (`/admin`)** — single column `space-y-6`:

```
┌───────────────────────────────────────────────────────────────────┐
│  h1 "Admin"  +  subtitle                                           │
├───────────────────────────────────────────────────────────────────┤
│  StatCards: [Users] [Groups] [Tenants] [Authorizations]            │  ← md:grid-cols-2 lg:grid-cols-4
├───────────────────────┬───────────────────────────────────────────┤
│  System info teaser   │  <ExtensionSlot point="admin.dashboard.section" />  │  ← plugin
└───────────────────────┴───────────────────────────────────────────┘
```

**List page (`/admin/users`, `/admin/groups`, etc.)** — single column `space-y-6`:

```
┌───────────────────────────────────────────────────────────────────┐
│  flex items-end justify-between:                                   │
│    h1 + subtitle              │   [New <thing>] (Button primary)   │
├───────────────────────────────────────────────────────────────────┤
│  Card { Filter row (search input) }                                 │
│  Card { Table (rows link to /admin/<thing>/[id]) }                  │
└───────────────────────────────────────────────────────────────────┘
```

**Detail / edit page (`/admin/users/[id]`)** — left rail with section nav + right pane:

```
┌──────────┬────────────────────────────────────────────────────────┐
│ Back     │  Header block (h1 username, subtitle id, badges)        │
│ Nav:     ├────────────────────────────────────────────────────────┤
│ Profile  │  Active section card                                    │
│ Password │                                                         │
│ Groups   │                                                         │
│ Tenants  │                                                         │
└──────────┴────────────────────────────────────────────────────────┘
```

Implementation: top-level `searchParams.section` chooses which card to render (server-rendered; no client tab state).

**Setup wizard (`/admin/setup`)** — centered narrow column:

```
            ┌──────────────────────────────────┐
            │  h1 "Welcome to Camunda"          │
            │  body-muted "Create the first user"
            ├──────────────────────────────────┤
            │  Card form (username, password, …)
            │  Submit → /api/admin/setup/{engine}/user/create
            └──────────────────────────────────┘
```

Container: `max-w-md mx-auto py-12`.

### Component composition rules

| Pattern | Use | Don't |
|---|---|---|
| Page title block | `<div className="space-y-1"><h1/><p className="text-muted-foreground text-sm"/></div>` | Heading without subtitle. |
| List Card + row link | `<Link>` wrapping a full `<TableRow>` is illegal — instead, first-column cell contains the `<Link>` for the row's primary identifier; row hover provided by Table defaults. | Wrapping `<TableRow>` in `<a>`. |
| Section nav (detail pages) | List of `<Link>` items styled like sidebar items; active link gets `bg-muted font-medium`. | Client-side Tabs primitive for routing-driven navigation. |
| Mutation form footer | `<div className="flex justify-end gap-2"><Button variant="ghost">Cancel</Button><Button>Save</Button></div>`. | Save buttons inside CardHeader. |
| Delete confirm | `<Dialog>` with explicit "Type <id> to confirm" for catastrophic deletes (user, group). | `window.confirm`. |
| Empty list | `<div className="text-muted-foreground p-6 text-sm">No X.</div>` inside `<CardContent>`. | Spinner placeholders. |
| Error state | `<div className="text-destructive p-6 text-sm">{message}</div>` inside `<CardContent>`. | Toast for load failures. |
| Plugin slot | `<ExtensionSlot point="X" props={{...}} fallback={null} />`. | Inlined per-feature lists. |

### Iconography (lucide-react)

| Domain | Icon |
|---|---|
| Users | `Users`, `User`, `UserPlus`, `UserMinus`, `UserCheck` |
| Groups | `UsersRound` |
| Tenants | `Building2` |
| Authorizations | `ShieldCheck`, `ShieldAlert` |
| Permissions allow/deny | `Check`, `X` |
| System | `Server`, `Activity`, `Cpu` |
| Telemetry | `Radar` |
| Settings | `Settings` |
| Metrics | `BarChart3`, `LineChart` |
| Save / Delete / Add / Back / Refresh | `Save`, `Trash2`, `Plus`, `ArrowLeft`, `RefreshCw` |

Size: `size-4` in buttons, `size-5` in card headers, `size-3` in dense badges.

### Forms

- Field layout: `<div className="space-y-1.5"><Label/><Input/><p className="text-xs text-muted-foreground">{help}</p></div>`.
- Required marker: `<Label>Username <span className="text-destructive">*</span></Label>`.
- Validation: HTML5 attrs + a `disabled={!isValid}` submit; server errors surfaced in `<p className="text-destructive text-xs">` below the offending field.
- Password fields: `type="password"` always; never echo. Confirm-password field on create/update flows.
- Submit busy: `<Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>`.

### Tables

- Wrap in Card; never bare.
- Columns ≤ 5 visible at desktop. Mono ID column: `font-mono text-xs`.
- Row actions: rightmost column, narrow (`w-20`), `<Button variant="ghost" size="icon">`.
- No virtualization in v1; cap server-side at `maxResults=500` per list (matches legacy).

### Responsive bar

- Only `md:` (768px) and `lg:` (1024px) breakpoints. Stat-card grid collapses to 1-col below `md:`. Detail page left-rail collapses to a `<Select>` switcher below `md:`.

---

## File Structure

**Already exists (reconciled, not rewritten):**

| File | Current state | Delta in this plan |
|---|---|---|
| `src/app/(app)/admin/page.tsx` | Dashboard skeleton | Add stat cards (users/groups/tenants/authorizations counts) + `admin.dashboard.section` slot host. |
| `src/app/(app)/admin/users/page.tsx` | Read-only users table | Add "New user" button; row link to `/admin/users/[id]`; add search input. |
| `src/app/(app)/admin/groups/page.tsx` | Read-only groups table | Add "New group" button; row link to `/admin/groups/[id]`; search. |
| `src/app/(app)/admin/authorizations/page.tsx` | Read-only authorizations table | Add "New authorization" button; per-row delete action with confirm dialog; filter by resource type. |

**Net-new — pages:**

| File | Responsibility |
|---|---|
| `src/app/(app)/admin/users/new/page.tsx` | Server-rendered Card with `<UserCreateForm>` client component. |
| `src/app/(app)/admin/users/[id]/page.tsx` | User detail/edit shell — section nav (Profile / Password / Groups / Tenants) reads `?section=`. |
| `src/app/(app)/admin/users/[id]/_components/user-profile-form.tsx` | Edit firstName/lastName/email (PUT `/user/{id}/profile`). |
| `src/app/(app)/admin/users/[id]/_components/user-password-form.tsx` | Change password (PUT `/user/{id}/credentials`, requires `authenticatedUserPassword`). |
| `src/app/(app)/admin/users/[id]/_components/user-groups-card.tsx` | List membership + add/remove (POST/DELETE `/group/{groupId}/members/{userId}`). |
| `src/app/(app)/admin/users/[id]/_components/user-tenants-card.tsx` | Same shape for `/tenant/{id}/user-members/{userId}`. |
| `src/app/(app)/admin/users/[id]/_components/delete-user-card.tsx` | Confirm-and-delete card (DELETE `/user/{id}`). |
| `src/app/(app)/admin/groups/new/page.tsx` | Mirror of users/new. |
| `src/app/(app)/admin/groups/[id]/page.tsx` | Section nav (Profile / Members / Tenants). |
| `src/app/(app)/admin/groups/[id]/_components/group-profile-form.tsx` | Edit `name`, `type` (PUT `/group/{id}`). |
| `src/app/(app)/admin/groups/[id]/_components/group-members-card.tsx` | Add/remove members. |
| `src/app/(app)/admin/groups/[id]/_components/group-tenants-card.tsx` | Tenant membership for the group. |
| `src/app/(app)/admin/groups/[id]/_components/delete-group-card.tsx` | Delete with confirm. |
| `src/app/(app)/admin/tenants/page.tsx` | Read-only list + "New tenant". |
| `src/app/(app)/admin/tenants/new/page.tsx` | Create form. |
| `src/app/(app)/admin/tenants/[id]/page.tsx` | Section nav (Profile / Users / Groups). |
| `src/app/(app)/admin/tenants/[id]/_components/tenant-profile-form.tsx` | Edit name (PUT `/tenant/{id}`). |
| `src/app/(app)/admin/tenants/[id]/_components/tenant-users-card.tsx` | POST/DELETE `/tenant/{id}/user-members/{userId}`. |
| `src/app/(app)/admin/tenants/[id]/_components/tenant-groups-card.tsx` | POST/DELETE `/tenant/{id}/group-members/{groupId}`. |
| `src/app/(app)/admin/tenants/[id]/_components/delete-tenant-card.tsx` | Delete with confirm. |
| `src/app/(app)/admin/authorizations/new/page.tsx` | Create authorization form (resourceType, resourceId, permissions, userId/groupId, type). |
| `src/app/(app)/admin/authorizations/_components/delete-authorization-button.tsx` | Confirm dialog launcher (mounted in the list row). |
| `src/app/(app)/admin/system/page.tsx` | System info dashboard (engine name, version, datastore type, history level). |
| `src/app/(app)/admin/system/settings/page.tsx` | System settings — telemetry on/off, display settings (date format etc.). |
| `src/app/(app)/admin/system/diagnostics/page.tsx` | Server info + license state display + telemetry data view. |
| `src/app/(app)/admin/system/execution-metrics/page.tsx` | Aggregated metrics — read from `/api/admin/plugin/adminPlugins/{engine}/metrics/aggregated`. |
| `src/app/(app)/admin/setup/page.tsx` | First-run wizard. Standalone (no app-shell session gate). |

**Net-new — route handlers (proxying engine-rest / webapp-rest):**

| File | Methods |
|---|---|
| `src/app/api/admin/users/route.ts` | POST → `/user/create` |
| `src/app/api/admin/users/[id]/route.ts` | PUT (profile), DELETE (`/user/{id}`) |
| `src/app/api/admin/users/[id]/credentials/route.ts` | PUT (`/user/{id}/credentials`) |
| `src/app/api/admin/users/[id]/profile/route.ts` | PUT (`/user/{id}/profile`) |
| `src/app/api/admin/groups/route.ts` | POST → `/group/create` |
| `src/app/api/admin/groups/[id]/route.ts` | PUT, DELETE |
| `src/app/api/admin/groups/[id]/members/[userId]/route.ts` | PUT (add), DELETE |
| `src/app/api/admin/tenants/route.ts` | POST → `/tenant/create` |
| `src/app/api/admin/tenants/[id]/route.ts` | PUT, DELETE |
| `src/app/api/admin/tenants/[id]/users/[userId]/route.ts` | PUT, DELETE |
| `src/app/api/admin/tenants/[id]/groups/[groupId]/route.ts` | PUT, DELETE |
| `src/app/api/admin/authorizations/route.ts` | POST → `/authorization/create` |
| `src/app/api/admin/authorizations/[id]/route.ts` | DELETE (`/authorization/{id}`) |
| `src/app/api/admin/setup/route.ts` | POST → `/api/admin/setup/{engine}/user/create` (NB: webapp-rest path, not engine-rest) |
| `src/app/api/admin/telemetry/route.ts` | GET/POST → `/telemetry/data` (GET) + `/telemetry/configuration` (POST) |

**Net-new — plugin:**

| File | Responsibility |
|---|---|
| `plugins/admin-base/plugin.json` | Registers `admin.dashboard.section` + `admin.system`. |
| `plugins/admin-base/client.tsx` | Two named exports — `LicenseAndTelemetryCard` (dashboard) and `RuntimeInfoCard` (system). |

**Net-new — e2e:**

| File |
|---|
| `e2e/admin-users-crud.spec.ts` |
| `e2e/admin-groups-crud.spec.ts` |
| `e2e/admin-tenants-crud.spec.ts` |
| `e2e/admin-authorizations-crud.spec.ts` |
| `e2e/admin-system-info.spec.ts` |
| `e2e/admin-setup-wizard.spec.ts` (special: requires resettable setup state) |

**Net-new — lib:**

| File | Responsibility |
|---|---|
| `src/lib/admin/permissions.ts` | Pure mapping of permission bitmask ↔ named permissions (`READ`, `UPDATE`, `DELETE`, `CREATE`, `ACCESS`, …) per resource type. |
| `src/lib/admin/permissions.test.ts` | Vitest tests for the mapping (covers every resource type in `engine-rest/authorization`). |

**Not touched (explicit):** `engine.ts`, `session.ts`, `proxy.ts`, `(app)/layout.tsx`, any shadcn primitive, any Java file.

---

## Task 0: BE handoff — confirm DTOs and webapp-rest endpoints

**Files:** none (read-only)

- [ ] **Step 1: Dispatch BE persona**

> Read-only investigation. Confirm shapes from `engine-rest/engine-rest/src/main/java/org/camunda/bpm/engine/rest/`:
> 1. `UserDto` (id, firstName, lastName, displayName, email) — fields + nullability.
> 2. `UserCredentialsDto` (password, authenticatedUserPassword) — confirm `authenticatedUserPassword` is required and how engine-rest reports its absence.
> 3. `GroupDto` (id, name, type) — nullability.
> 4. `TenantDto` (id, name).
> 5. `AuthorizationDto` (id, type 0/1/2 = grant/deny/global, permissions number, resourceType number, resourceId string, userId, groupId, removalTime).
> 6. `AuthorizationCheckResultDto` for `/authorization/check` if used.
> 7. `Permissions` enum and the bitmask formula for the `/authorization/create` POST payload (we need to know whether the API takes `["READ","UPDATE"]` array OR the numeric bitmask).
> 8. Resource type integer codes for `Authorization`, `User`, `Group`, `Tenant`, `Application`, `Process Definition`, `Process Instance`, `Task`, `Deployment`, `Batch`, `Decision Definition`, `Decision Requirements Definition`, `Filter`, `History`, `Optimize`, `System`.
> 9. Confirm `/version` endpoint shape and any product-info fields.
>
> Read-only investigation in `webapps/webapp-rest/src/main/java/org/camunda/bpm/webapp/rest/`:
> 10. `/api/admin/setup/{engine}/user/create` payload shape — confirm it accepts `{ profile: UserProfileDto, credentials: { password: string } }`.
> 11. `/api/admin/plugin/adminPlugins/{engine}/metrics/aggregated` query params (`subscriptionMonth`, `groupBy`) and response shape (an array of `{ metric: string, subscriptionMonth: string, sum: number }`).
> 12. Telemetry endpoints — `/telemetry/data` GET shape, `/telemetry/configuration` POST shape (`{ enableTelemetry: boolean }`).
>
> Return a markdown report under `docs/superpowers/specs/evidence/phase-3/be-dto-report.md`.

- [ ] **Step 2: Capture + commit the report**

```bash
git add docs/superpowers/specs/evidence/phase-3/be-dto-report.md
git commit -m "docs(phase-3): capture engine-rest + webapp-rest DTO shapes for admin"
```

- [ ] **Step 3: Patch downstream tasks if shapes diverge**

If permission encoding is a numeric bitmask (not array), patch Task 14 + `src/lib/admin/permissions.ts` before writing code.

---

## Task 1: Reconcile existing in-progress files

**Files:**
- Read: `src/app/(app)/admin/page.tsx`, `users/page.tsx`, `groups/page.tsx`, `authorizations/page.tsx`
- Write: `docs/superpowers/specs/evidence/phase-3/reconcile.md`

- [ ] **Step 1: Read each existing file**

Record current behavior vs. promised behavior from File Structure table.

- [ ] **Step 2: Write reconcile.md (one line per task in this plan: status + blockers)**

- [ ] **Step 3: Patch task steps inline if existing code diverges from this plan's expected starting point**

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-3/reconcile.md
git commit -m "docs(phase-3): reconcile in-progress admin state vs. plan"
```

---

## Task 2: Permission mapping utility

**Files:**
- Create: `src/lib/admin/permissions.ts`
- Create: `src/lib/admin/permissions.test.ts`

- [ ] **Step 1: Encode resource types**

Use numeric codes confirmed in Task 0. Skeleton:

```ts
export const RESOURCE_TYPES = {
  AUTHORIZATION: 4,
  USER: 1,
  GROUP: 2,
  TENANT: 11,
  APPLICATION: 5,
  PROCESS_DEFINITION: 6,
  PROCESS_INSTANCE: 8,
  TASK: 7,
  DEPLOYMENT: 9,
  BATCH: 13,
  DECISION_DEFINITION: 10,
  DECISION_REQUIREMENTS_DEFINITION: 14,
  FILTER: 5, // placeholder — confirm with Task 0 report
  HISTORY: 17,
  OPTIMIZE: 18,
  SYSTEM: 15,
} as const;

export type ResourceType = keyof typeof RESOURCE_TYPES;
```

- [ ] **Step 2: Encode permissions per resource (named ↔ bitmask)**

```ts
// Permission enums per resource type. Verify each against engine-rest Permissions.java in Task 0.
export const PERMISSIONS: Record<ResourceType, Record<string, number>> = {
  AUTHORIZATION: { ALL: 2147483647, NONE: 0, READ: 2, UPDATE: 4, CREATE: 8, DELETE: 16 },
  USER: { ALL: 2147483647, NONE: 0, READ: 2, UPDATE: 4, CREATE: 8, DELETE: 16 },
  GROUP: { ALL: 2147483647, NONE: 0, READ: 2, UPDATE: 4, CREATE: 8, DELETE: 16 },
  // ...fill rest from Task 0 evidence
} as Record<ResourceType, Record<string, number>>;

export function encodePermissions(rt: ResourceType, names: string[]): number {
  const table = PERMISSIONS[rt];
  return names.reduce((acc, n) => acc | (table[n] ?? 0), 0);
}

export function decodePermissions(rt: ResourceType, mask: number): string[] {
  const table = PERMISSIONS[rt];
  if (mask === table.ALL) return ["ALL"];
  if (mask === 0) return ["NONE"];
  return Object.entries(table)
    .filter(([n, v]) => n !== "ALL" && n !== "NONE" && (mask & v) === v && v > 0)
    .map(([n]) => n);
}
```

- [ ] **Step 3: Write vitest tests**

```ts
import { describe, expect, test } from "vitest";
import { decodePermissions, encodePermissions } from "./permissions";

describe("permissions", () => {
  test("roundtrips READ + UPDATE on USER", () => {
    const mask = encodePermissions("USER", ["READ", "UPDATE"]);
    expect(decodePermissions("USER", mask).sort()).toEqual(["READ", "UPDATE"]);
  });
  test("ALL collapses", () => {
    const mask = encodePermissions("USER", ["ALL"]);
    expect(decodePermissions("USER", mask)).toEqual(["ALL"]);
  });
  test("NONE", () => {
    expect(decodePermissions("USER", 0)).toEqual(["NONE"]);
  });
});
```

- [ ] **Step 4: Run + commit**

DevOps: `npx vitest run src/lib/admin/permissions.test.ts`.

```bash
git add src/lib/admin/permissions.ts src/lib/admin/permissions.test.ts
git commit -m "feat(admin): permission bitmask ↔ named encoding utility + tests"
```

---

## Task 3: Admin dashboard — stat cards + plugin slot

**Files:**
- Modify: `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Read existing**

Confirm current behavior.

- [ ] **Step 2: Rewrite as a stat dashboard**

```tsx
import { Users, UsersRound, Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

async function safeCount(path: string): Promise<number | null> {
  try {
    const r = await engineGet<{ count: number }>(path);
    return r.count;
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const [users, groups, tenants, auths] = await Promise.all([
    safeCount("/user/count"),
    safeCount("/group/count"),
    safeCount("/tenant/count"),
    safeCount("/authorization/count"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">Identity and authorizations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Users" value={users} icon={<Users className="text-muted-foreground size-4" />} />
        <StatCard title="Groups" value={groups} icon={<UsersRound className="text-muted-foreground size-4" />} />
        <StatCard title="Tenants" value={tenants} icon={<Building2 className="text-muted-foreground size-4" />} />
        <StatCard title="Authorizations" value={auths} icon={<ShieldCheck className="text-muted-foreground size-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExtensionSlot point="admin.dashboard.section" fallback={null} />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | null; icon: React.ReactNode }) {
  const display = value === null ? "—" : new Intl.NumberFormat().format(value);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{display}</div>
        <p className="text-muted-foreground text-xs">{value === null ? "Engine unreachable" : "Total"}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/page.tsx
git commit -m "feat(admin): dashboard stat cards + admin.dashboard.section slot"
```

---

## Task 4: Users list — link rows + New user button + search

**Files:**
- Modify: `src/app/(app)/admin/users/page.tsx`

- [ ] **Step 1: Update layout (header has flex-justify-between + primary button)**

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type EngineUser = { id: string; firstName: string | null; lastName: string | null; displayName?: string | null; email: string | null };

async function loadUsers(q: string | undefined): Promise<{ users: EngineUser[]; error: string | null }> {
  try {
    const qs = q ? `?firstResult=0&maxResults=500&firstNameLike=%25${encodeURIComponent(q)}%25` : "?firstResult=0&maxResults=500";
    const users = await engineGet<EngineUser[]>(`/user${qs}`);
    return { users, error: null };
  } catch (err) {
    return { users: [], error: err instanceof Error ? err.message : "Failed" };
  }
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { users, error } = await loadUsers(q);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Identities managed by the Camunda engine.</p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new"><Plus className="mr-1 size-4" /> New user</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <form action="/admin/users" className="flex items-center gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by first name…" className="max-w-sm" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>{users.length} loaded.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No users.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>First name</TableHead>
                  <TableHead>Last name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/admin/users/${encodeURIComponent(u.id)}`} className="hover:underline">{u.id}</Link>
                    </TableCell>
                    <TableCell>{u.firstName ?? "—"}</TableCell>
                    <TableCell>{u.lastName ?? "—"}</TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/admin/users/page.tsx
git commit -m "feat(admin): users list — search + new user + row links"
```

---

## Task 5: User create form

**Files:**
- Create: `src/app/(app)/admin/users/new/page.tsx`
- Create: `src/app/(app)/admin/users/new/_components/user-create-form.tsx`
- Create: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: API route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const body = await req.json();
  const res = await engineFetch(`/user/create`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Page**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCreateForm } from "./_components/user-create-form";

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/users"><ArrowLeft className="mr-2 size-4" /> Back to users</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create user</h1>
        <p className="text-muted-foreground text-sm">Adds a new identity to the engine.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Profile + credentials</CardTitle></CardHeader>
        <CardContent><UserCreateForm /></CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Client form**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { id: form.id, firstName: form.firstName, lastName: form.lastName, email: form.email },
          credentials: { password: form.password },
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status}).`);
        return;
      }
      router.push(`/admin/users/${encodeURIComponent(form.id)}`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="id" label="User ID" required value={form.id} onChange={(v) => update("id", v)} />
        <Field id="email" label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
        <Field id="firstName" label="First name" required value={form.firstName} onChange={(v) => update("firstName", v)} />
        <Field id="lastName" label="Last name" required value={form.lastName} onChange={(v) => update("lastName", v)} />
      </div>
      <div className="border-t pt-4 grid gap-4 md:grid-cols-2">
        <Field id="password" label="Password" type="password" required value={form.password} onChange={(v) => update("password", v)} />
        <Field id="passwordConfirm" label="Confirm password" type="password" required value={form.passwordConfirm} onChange={(v) => update("passwordConfirm", v)} />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create user"}</Button>
      </div>
    </form>
  );
}

function Field({ id, label, value, onChange, type = "text", required }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/\(app\)/admin/users/new
git commit -m "feat(admin): user create form + POST /api/admin/users"
```

---

## Task 6: User detail/edit shell + section nav

**Files:**
- Create: `src/app/(app)/admin/users/[id]/page.tsx`
- Create: `src/app/(app)/admin/users/[id]/_components/section-nav.tsx`

- [ ] **Step 1: Shell page (`page.tsx`)**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { engineGet } from "@/lib/camunda/engine";

import { SectionNav } from "./_components/section-nav";
import { UserProfileForm } from "./_components/user-profile-form";
import { UserPasswordForm } from "./_components/user-password-form";
import { UserGroupsCard } from "./_components/user-groups-card";
import { UserTenantsCard } from "./_components/user-tenants-card";
import { DeleteUserCard } from "./_components/delete-user-card";

type UserProfile = { id: string; firstName: string | null; lastName: string | null; email: string | null };

async function load(id: string): Promise<UserProfile | null> {
  try {
    const u = await engineGet<UserProfile>(`/user/${encodeURIComponent(id)}/profile`);
    return u;
  } catch {
    return null;
  }
}

const SECTIONS = ["profile", "password", "groups", "tenants", "danger"] as const;
type Section = (typeof SECTIONS)[number];

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section: raw } = await searchParams;
  const section: Section = SECTIONS.includes(raw as Section) ? (raw as Section) : "profile";
  const user = await load(id);

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild><Link href="/admin/users"><ArrowLeft className="mr-2 size-4" /> Back</Link></Button>
        <div className="text-muted-foreground p-6 text-sm">User not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/users"><ArrowLeft className="mr-2 size-4" /> Back to users</Link>
      </Button>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{user.firstName ?? user.id} {user.lastName ?? ""}</h1>
          <p className="text-muted-foreground text-sm"><code className="bg-muted rounded px-1 text-xs">{user.id}</code></p>
        </div>
        <Badge variant="secondary">User</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <SectionNav id={user.id} active={section} />
        <div>
          {section === "profile" && <UserProfileForm user={user} />}
          {section === "password" && <UserPasswordForm userId={user.id} />}
          {section === "groups" && <UserGroupsCard userId={user.id} />}
          {section === "tenants" && <UserTenantsCard userId={user.id} />}
          {section === "danger" && <DeleteUserCard userId={user.id} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SectionNav**

```tsx
import Link from "next/link";

type Active = "profile" | "password" | "groups" | "tenants" | "danger";

const ITEMS: Array<{ key: Active; label: string; tone?: "danger" }> = [
  { key: "profile", label: "Profile" },
  { key: "password", label: "Password" },
  { key: "groups", label: "Groups" },
  { key: "tenants", label: "Tenants" },
  { key: "danger", label: "Delete user", tone: "danger" },
];

export function SectionNav({ id, active }: { id: string; active: Active }) {
  return (
    <nav className="space-y-1">
      {ITEMS.map((it) => {
        const isActive = active === it.key;
        const danger = it.tone === "danger";
        return (
          <Link
            key={it.key}
            href={`/admin/users/${encodeURIComponent(id)}?section=${it.key}`}
            className={`block rounded px-2 py-1.5 text-sm ${isActive ? "bg-muted font-medium" : "hover:bg-muted/50"} ${danger ? "text-destructive" : ""}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Commit (without the section components yet — they land in Tasks 7–10)**

```bash
git add src/app/\(app\)/admin/users/\[id\]/page.tsx src/app/\(app\)/admin/users/\[id\]/_components/section-nav.tsx
git commit -m "feat(admin): user detail shell + section nav (sections wired in next commits)"
```

---

## Task 7: User profile form

**Files:**
- Create: `src/app/(app)/admin/users/[id]/_components/user-profile-form.tsx`
- Create: `src/app/api/admin/users/[id]/profile/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json();
  const res = await engineFetch(`/user/${encodeURIComponent(id)}/profile`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Form**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = { id: string; firstName: string | null; lastName: string | null; email: string | null };

export function UserProfileForm({ user }: { user: Profile }) {
  const [form, setForm] = useState({ ...user });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMsg(res.ok ? "Saved." : `Failed (${res.status}).`);
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Pair label="First name" value={form.firstName ?? ""} onChange={(v) => setForm({ ...form, firstName: v })} />
            <Pair label="Last name" value={form.lastName ?? ""} onChange={(v) => setForm({ ...form, lastName: v })} />
            <Pair label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="flex items-center justify-end gap-3">
            {msg ? <span className="text-muted-foreground text-xs">{msg}</span> : null}
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Pair({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/\[id\]/profile src/app/\(app\)/admin/users/\[id\]/_components/user-profile-form.tsx
git commit -m "feat(admin): user profile edit (PUT /user/{id}/profile)"
```

---

## Task 8: User password form

**Files:**
- Create: `src/app/(app)/admin/users/[id]/_components/user-password-form.tsx`
- Create: `src/app/api/admin/users/[id]/credentials/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const body = await req.json(); // { password, authenticatedUserPassword }
  const res = await engineFetch(`/user/${encodeURIComponent(id)}/credentials`, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Form**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserPasswordForm({ userId }: { userId: string }) {
  const [form, setForm] = useState({ password: "", confirm: "", auth: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password, authenticatedUserPassword: form.auth }),
      });
      if (res.ok) setOk(true);
      else setError(`Failed (${res.status}).`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Requires confirmation of <em>your</em> password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Pair label="New password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <Pair label="Confirm new password" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
          </div>
          <Pair label="Your current password" type="password" value={form.auth} onChange={(v) => setForm({ ...form, auth: v })} />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {ok ? <p className="text-muted-foreground text-sm">Password updated.</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Change password"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Pair({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/\[id\]/credentials src/app/\(app\)/admin/users/\[id\]/_components/user-password-form.tsx
git commit -m "feat(admin): user password change (PUT /user/{id}/credentials)"
```

---

## Task 9: User groups card (membership)

**Files:**
- Create: `src/app/(app)/admin/users/[id]/_components/user-groups-card.tsx`
- Create: `src/app/api/admin/groups/[id]/members/[userId]/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, userId } = await params;
  const res = await engineFetch(`/group/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "PUT" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, userId } = await params;
  const res = await engineFetch(`/group/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Card (server + client editor)**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { UserGroupsEditor } from "./user-groups-editor";

type Group = { id: string; name: string | null; type: string | null };

async function load(userId: string): Promise<Group[]> {
  try {
    return await engineGet<Group[]>(`/group?member=${encodeURIComponent(userId)}&maxResults=200`);
  } catch {
    return [];
  }
}

export async function UserGroupsCard({ userId }: { userId: string }) {
  const groups = await load(userId);
  return (
    <Card>
      <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
      <CardContent>
        <UserGroupsEditor userId={userId} initial={groups} />
      </CardContent>
    </Card>
  );
}
```

Editor (client) — `user-groups-editor.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type Group = { id: string; name: string | null; type: string | null };

export function UserGroupsEditor({ userId, initial }: { userId: string; initial: Group[] }) {
  const [groups, setGroups] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/groups/${encodeURIComponent(draft)}/members/${encodeURIComponent(userId)}`, { method: "PUT" });
      if (res.ok) {
        setGroups((p) => [...p, { id: draft, name: null, type: null }]);
        setDraft("");
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/admin/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (res.ok) setGroups((p) => p.filter((g) => g.id !== id));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {groups.length === 0 ? <p className="text-muted-foreground text-sm">No groups.</p> : groups.map((g) => (
          <Badge key={g.id} variant="secondary" className="gap-1">
            {g.name ?? g.id}
            <button onClick={() => remove(g.id)} disabled={pending} aria-label="Remove" className="hover:text-destructive"><X className="size-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="group id" />
        <Button onClick={add} disabled={pending || !draft.trim()}>Add</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/groups/\[id\]/members src/app/\(app\)/admin/users/\[id\]/_components/user-groups-card.tsx src/app/\(app\)/admin/users/\[id\]/_components/user-groups-editor.tsx
git commit -m "feat(admin): user-group membership editor"
```

---

## Task 10: User tenants card + delete user

**Files:**
- Create: `src/app/(app)/admin/users/[id]/_components/user-tenants-card.tsx`
- Create: `src/app/(app)/admin/users/[id]/_components/delete-user-card.tsx`
- Create: `src/app/api/admin/tenants/[id]/users/[userId]/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Tenant-user route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, userId } = await params;
  const res = await engineFetch(`/tenant/${encodeURIComponent(id)}/user-members/${encodeURIComponent(userId)}`, { method: "PUT" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id, userId } = await params;
  const res = await engineFetch(`/tenant/${encodeURIComponent(id)}/user-members/${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: User DELETE route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/user/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Tenants card**

Same shape as the groups card from Task 9 — adapt the endpoint and the list source (`engine-rest/tenant?userMember=...`).

- [ ] **Step 4: Delete card**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export function DeleteUserCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/users");
      else setError(`Delete failed (${res.status}).`);
    });

  const armed = confirm === userId;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete user</CardTitle>
        <CardDescription>Permanent. Type <code className="bg-muted rounded px-1 text-xs">{userId}</code> to confirm.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Confirmation</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex justify-end">
          <Button variant="destructive" disabled={!armed || pending} onClick={submit}>
            <Trash2 className="mr-1 size-4" /> {pending ? "Deleting…" : "Delete user"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Wire both into the user detail shell (Task 6 already imports them)**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/tenants/\[id\]/users src/app/api/admin/users/\[id\]/route.ts src/app/\(app\)/admin/users/\[id\]/_components/{user-tenants-card,delete-user-card}.tsx
git commit -m "feat(admin): user tenants editor + danger-zone delete"
```

---

## Task 11: Groups CRUD (list + new + detail with sub-cards + delete)

**Files:**
- Modify: `src/app/(app)/admin/groups/page.tsx`
- Create: `src/app/(app)/admin/groups/new/page.tsx` + `_components/group-create-form.tsx`
- Create: `src/app/(app)/admin/groups/[id]/page.tsx` (mirror of users/[id])
- Create: `src/app/(app)/admin/groups/[id]/_components/{section-nav,group-profile-form,group-members-card,group-tenants-card,delete-group-card}.tsx`
- Create: `src/app/api/admin/groups/route.ts` (POST create)
- Create: `src/app/api/admin/groups/[id]/route.ts` (PUT update, DELETE)

- [ ] **Step 1: List page**

Same pattern as users list (Task 4) — header with "New group" CTA, search input, table with row links.

- [ ] **Step 2: New + detail + section components**

Same shape as users (Tasks 5–10). Endpoints:
- Create: `POST /group/create` body `{ id, name, type }`.
- Profile update: `PUT /group/{id}` body `{ id, name, type }`.
- Members: `PUT/DELETE /group/{id}/members/{userId}`.
- Group→tenants: `engine-rest/tenant?groupMember=...` (list), `PUT/DELETE /tenant/{id}/group-members/{groupId}`.
- Delete: `DELETE /group/{id}`.

- [ ] **Step 3: Route files**

`src/app/api/admin/groups/route.ts`, `[id]/route.ts` — mirror user equivalents.

- [ ] **Step 4: Commit (one commit per logical sub-step recommended)**

```bash
git add src/app/api/admin/groups src/app/\(app\)/admin/groups
git commit -m "feat(admin): groups CRUD — list / new / edit / members / tenants / delete"
```

---

## Task 12: Tenants CRUD

**Files:**
- Create: `src/app/(app)/admin/tenants/page.tsx`
- Create: `src/app/(app)/admin/tenants/new/page.tsx` + `_components/tenant-create-form.tsx`
- Create: `src/app/(app)/admin/tenants/[id]/page.tsx`
- Create: `src/app/(app)/admin/tenants/[id]/_components/{section-nav,tenant-profile-form,tenant-users-card,tenant-groups-card,delete-tenant-card}.tsx`
- Create: `src/app/api/admin/tenants/route.ts`
- Create: `src/app/api/admin/tenants/[id]/route.ts`
- Create: `src/app/api/admin/tenants/[id]/groups/[groupId]/route.ts`
- Modify: `src/components/app-shell/nav-items.ts` — add Tenants under Admin

- [ ] **Step 1–4: Mirror the users/groups patterns from Tasks 4–11**

Endpoints:
- List: `GET /tenant?firstResult=0&maxResults=200`.
- Create: `POST /tenant/create` body `{ id, name }`.
- Update: `PUT /tenant/{id}`.
- User members: `engine-rest/user?memberOfTenant={id}`, mutations `/tenant/{id}/user-members/{userId}`.
- Group members: `engine-rest/group?memberOfTenant={id}`, mutations `/tenant/{id}/group-members/{groupId}`.
- Delete: `DELETE /tenant/{id}`.

- [ ] **Step 5: Update sidebar nav**

In `src/components/app-shell/nav-items.ts`, insert `{ title: "Tenants", url: "/admin/tenants", icon: Building2 }` under the Admin section.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/tenants src/app/\(app\)/admin/tenants src/components/app-shell/nav-items.ts
git commit -m "feat(admin): tenants CRUD + sidebar nav entry"
```

---

## Task 13: Authorizations — delete confirm + filter

**Files:**
- Modify: `src/app/(app)/admin/authorizations/page.tsx`
- Create: `src/app/(app)/admin/authorizations/_components/delete-authorization-button.tsx`
- Create: `src/app/api/admin/authorizations/[id]/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await verifyCsrfFromRequest(req);
  const { id } = await params;
  const res = await engineFetch(`/authorization/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Delete button (confirm dialog)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function DeleteAuthorizationButton({ id, summary }: { id: string; summary: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await fetch(`/api/admin/authorizations/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) { setOpen(false); router.refresh(); }
    });

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Delete"><Trash2 className="size-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete authorization?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">{summary}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Mount in the list row + add resource-type filter**

In `src/app/(app)/admin/authorizations/page.tsx`, add a `<select name="resourceType">` filter (search params) and a trailing column rendering `<DeleteAuthorizationButton id={a.id} summary={...} />`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/authorizations/\[id\] src/app/\(app\)/admin/authorizations
git commit -m "feat(admin): authorization delete confirm + resource-type filter"
```

---

## Task 14: Authorization create form

**Files:**
- Create: `src/app/(app)/admin/authorizations/new/page.tsx`
- Create: `src/app/(app)/admin/authorizations/new/_components/authorization-create-form.tsx`
- Create: `src/app/api/admin/authorizations/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const body = await req.json();
  const res = await engineFetch(`/authorization/create`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return Response.json(await res.json(), { status: 201 });
}
```

- [ ] **Step 2: Form**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { encodePermissions, PERMISSIONS, RESOURCE_TYPES, type ResourceType } from "@/lib/admin/permissions";

const TYPE_LABELS: Record<number, string> = { 0: "Grant", 1: "Deny", 2: "Global" };

export function AuthorizationCreateForm() {
  const router = useRouter();
  const [type, setType] = useState(0);
  const [rt, setRt] = useState<ResourceType>("USER");
  const [resourceId, setResourceId] = useState("*");
  const [identityKind, setIdentityKind] = useState<"user" | "group">("user");
  const [identityId, setIdentityId] = useState("");
  const [selected, setSelected] = useState<string[]>(["READ"]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const togglePerm = (n: string) =>
    setSelected((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      type,
      permissions: selected, // engine-rest accepts string array per Task 0 evidence; switch to bitmask if needed
      resourceType: RESOURCE_TYPES[rt],
      resourceId,
      userId: identityKind === "user" ? identityId || "*" : null,
      groupId: identityKind === "group" ? identityId || "*" : null,
    };
    startTransition(async () => {
      const res = await fetch(`/api/admin/authorizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) router.push("/admin/authorizations");
      else setError(`Failed (${res.status}).`);
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>New authorization</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={String(type)} onValueChange={(v) => setType(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resource type</Label>
              <Select value={rt} onValueChange={(v) => setRt(v as ResourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(RESOURCE_TYPES).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resource ID</Label>
              <Input value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
              <p className="text-xs text-muted-foreground">Use <code className="bg-muted rounded px-1">*</code> for all.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Identity</Label>
              <div className="flex gap-2">
                <Select value={identityKind} onValueChange={(v) => setIdentityKind(v as "user" | "group")}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={identityId} onChange={(e) => setIdentityId(e.target.value)} placeholder="* or id" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-3">
              {Object.keys(PERMISSIONS[rt] ?? {}).filter((n) => n !== "NONE").map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={selected.includes(n)} onCheckedChange={() => togglePerm(n)} />
                  {n}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Page wrapper**

Standard server page with back link + form.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/authorizations/route.ts src/app/\(app\)/admin/authorizations/new
git commit -m "feat(admin): authorization create form"
```

---

## Task 15: System info page

**Files:**
- Create: `src/app/(app)/admin/system/page.tsx`

- [ ] **Step 1: Page**

```tsx
import { Activity, Cpu, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

type Version = { version: string };

async function safeGet<T>(path: string): Promise<T | null> {
  try { return await engineGet<T>(path); } catch { return null; }
}

export default async function SystemPage() {
  const [version, engines, schemaLog] = await Promise.all([
    safeGet<Version>("/version"),
    safeGet<Array<{ name: string }>>("/engine"),
    safeGet<Array<{ id: string; version: string; timestamp: string }>>("/schema/log?maxResults=1&sortBy=timestamp&sortOrder=desc"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-muted-foreground text-sm">Engine runtime info.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Engine version" value={version?.version ?? "—"} icon={<Cpu className="text-muted-foreground size-4" />} />
        <InfoCard title="Engines" value={String(engines?.length ?? "—")} icon={<Server className="text-muted-foreground size-4" />} />
        <InfoCard title="Latest schema" value={schemaLog?.[0]?.version ?? "—"} icon={<Activity className="text-muted-foreground size-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExtensionSlot point="admin.system" fallback={null} />
      </div>
    </div>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}
      </CardHeader>
      <CardContent><div className="text-xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/admin/system/page.tsx
git commit -m "feat(admin): system info page + admin.system slot"
```

---

## Task 16: System settings (telemetry + display)

**Files:**
- Create: `src/app/(app)/admin/system/settings/page.tsx`
- Create: `src/app/(app)/admin/system/settings/_components/telemetry-toggle.tsx`
- Create: `src/app/(app)/admin/system/settings/_components/display-settings.tsx`
- Create: `src/app/api/admin/telemetry/route.ts`

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

export async function GET() {
  try {
    const cfg = await engineGet<{ enableTelemetry: boolean | null }>(`/telemetry/configuration`);
    return Response.json(cfg);
  } catch {
    return Response.json({ enableTelemetry: null });
  }
}

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const body = await req.json();
  const res = await engineFetch(`/telemetry/configuration`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "engine" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Telemetry toggle**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TelemetryToggle({ initial }: { initial: boolean | null }) {
  const [on, setOn] = useState(Boolean(initial));
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setOn(next);
    startTransition(async () => {
      await fetch(`/api/admin/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableTelemetry: next }),
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry</CardTitle>
        <CardDescription>Send anonymized usage data to Camunda.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-sm">{on ? "Enabled" : "Disabled"} {initial === null ? "(initial state unknown — endpoint unreachable)" : ""}</p>
        <Switch checked={on} onCheckedChange={toggle} disabled={pending} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Display settings (locale, date format)**

Stored client-side in localStorage; toggles update via a `useEffect`. Skeleton with selects for locale (`en` / `de`) and date format pattern.

- [ ] **Step 4: Settings page (server)**

```tsx
import { engineGet } from "@/lib/camunda/engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelemetryToggle } from "./_components/telemetry-toggle";
import { DisplaySettings } from "./_components/display-settings";

export default async function SettingsPage() {
  let enable: boolean | null = null;
  try {
    const cfg = await engineGet<{ enableTelemetry: boolean | null }>(`/telemetry/configuration`);
    enable = cfg.enableTelemetry;
  } catch { /* keep null */ }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">System settings</h1>
        <p className="text-muted-foreground text-sm">Telemetry and display preferences.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TelemetryToggle initial={enable} />
        <DisplaySettings />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/admin/system/settings src/app/api/admin/telemetry
git commit -m "feat(admin): system settings — telemetry toggle + display prefs"
```

---

## Task 17: Diagnostics

**Files:**
- Create: `src/app/(app)/admin/system/diagnostics/page.tsx`

- [ ] **Step 1: Page**

Shows three Cards: Server info (`/version`, engine list), License state (read-only display, no install — per Q2), Telemetry data (`/telemetry/data`).

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

async function safe<T>(p: string): Promise<T | null> { try { return await engineGet<T>(p); } catch { return null; } }

export default async function DiagnosticsPage() {
  const [version, engines, license, telemetry] = await Promise.all([
    safe<{ version: string }>("/version"),
    safe<Array<{ name: string }>>("/engine"),
    safe<{ valid: boolean; expirationDate?: string; subscriptionType?: string }>("/license/key"),
    safe<unknown>("/telemetry/data"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Diagnostics</h1>
        <p className="text-muted-foreground text-sm">Read-only runtime information.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Server info</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm">Engine version: <code className="bg-muted rounded px-1 text-xs">{version?.version ?? "—"}</code></p>
          <p className="text-sm">Engines: {engines ? engines.map((e) => e.name).join(", ") : "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>License</CardTitle>
          <CardDescription>Display-only. Community is EOL upstream — no install action.</CardDescription>
        </CardHeader>
        <CardContent>
          {license ? (
            <pre className="bg-muted text-muted-foreground rounded p-3 text-xs">{JSON.stringify(license, null, 2)}</pre>
          ) : <p className="text-muted-foreground text-sm">No license endpoint response.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Telemetry data</CardTitle></CardHeader>
        <CardContent>
          <pre className="bg-muted text-muted-foreground max-h-80 overflow-auto rounded p-3 text-xs">{telemetry ? JSON.stringify(telemetry, null, 2) : "—"}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/admin/system/diagnostics/page.tsx
git commit -m "feat(admin): diagnostics page (server info + license display + telemetry data)"
```

---

## Task 18: Execution metrics

**Files:**
- Create: `src/app/(app)/admin/system/execution-metrics/page.tsx`
- Create: `src/app/(app)/admin/system/execution-metrics/_components/metrics-chart.tsx`

- [ ] **Step 1: Page**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

type Aggregated = { metric: string; subscriptionMonth: string; sum: number };

async function loadAggregated(yyyymm: string): Promise<Aggregated[]> {
  try {
    return await engineGet<Aggregated[]>(`/api/admin/plugin/adminPlugins/default/metrics/aggregated?subscriptionMonth=${yyyymm}`);
  } catch {
    return [];
  }
}

export default async function ExecutionMetricsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const ym = month ?? new Date().toISOString().slice(0, 7);
  const data = await loadAggregated(ym);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Execution metrics</h1>
        <p className="text-muted-foreground text-sm">Aggregated by metric for subscription month <code className="bg-muted rounded px-1 text-xs">{ym}</code>.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
          <CardDescription>Source: <code className="bg-muted rounded px-1 text-xs">/api/admin/plugin/adminPlugins/default/metrics/aggregated</code></CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No metrics for this month.</div>
          ) : (
            <ul className="divide-y">
              {data.map((d) => (
                <li key={d.metric} className="flex items-center justify-between px-4 py-2">
                  <code className="bg-muted rounded px-1 text-xs">{d.metric}</code>
                  <span className="text-sm font-medium">{new Intl.NumberFormat().format(d.sum)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: (optional) chart**

Reuse `recharts` (already a dep per the welcome-tasklist plan deps audit) for a simple bar chart by metric — render inside a Card next to the totals list.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/system/execution-metrics
git commit -m "feat(admin): execution metrics (aggregated by metric/month)"
```

---

## Task 19: Setup wizard

**Files:**
- Create: `src/app/(app)/admin/setup/page.tsx`
- Create: `src/app/(app)/admin/setup/_components/setup-form.tsx`
- Create: `src/app/api/admin/setup/route.ts`
- Modify: `src/proxy.ts` (allowlist `/admin/setup` without session redirect — verify what Phase 0 ships)

- [ ] **Step 1: Route**

```ts
import { verifyCsrfFromRequest } from "@/lib/auth/csrf";
import { engineFetch } from "@/lib/camunda/engine";

export async function POST(req: Request) {
  await verifyCsrfFromRequest(req);
  const body = await req.json();
  const engine = body.engine ?? "default";
  // NB: webapp-rest path, not engine-rest. The proxy in next.config.mjs rewrites /api/admin/*
  // to the same host's webapp-rest module.
  const res = await fetch(`/api/admin/setup/${encodeURIComponent(engine)}/user/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: body.profile, credentials: body.credentials }),
  });
  if (!res.ok) return Response.json({ error: { status: res.status, message: "setup" } }, { status: res.status });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Form**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", firstName: "", lastName: "", email: "", password: "", confirm: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    startTransition(async () => {
      const res = await fetch(`/api/admin/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: "default",
          profile: { id: form.id, firstName: form.firstName, lastName: form.lastName, email: form.email },
          credentials: { password: form.password },
        }),
      });
      if (res.ok) router.push("/login");
      else setError(`Setup failed (${res.status}).`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>First admin user</CardTitle>
        <CardDescription>Create the initial administrator. Subsequent setup happens in the admin app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Pair label="User ID" value={form.id} onChange={(v) => setForm({ ...form, id: v })} required />
          <div className="grid gap-4 md:grid-cols-2">
            <Pair label="First name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Pair label="Last name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
          </div>
          <Pair label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid gap-4 md:grid-cols-2">
            <Pair label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
            <Pair label="Confirm" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} required />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating…" : "Create administrator"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Pair({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
import { SetupForm } from "./_components/setup-form";

export default function SetupPage() {
  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Camunda</h1>
        <p className="text-muted-foreground text-sm">Initial setup.</p>
      </div>
      <SetupForm />
    </div>
  );
}
```

- [ ] **Step 4: Middleware allowlist**

In `src/proxy.ts` confirm `/admin/setup` is not redirected to `/login` for unauthenticated visitors. If Phase 0 doesn't already do this, add an early-return for that path.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/admin/setup src/app/api/admin/setup src/proxy.ts
git commit -m "feat(admin): first-run setup wizard (creates admin via webapp-rest)"
```

---

## Task 20: admin-base plugin

**Files:**
- Create: `plugins/admin-base/plugin.json`
- Create: `plugins/admin-base/client.tsx`
- Modify: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Manifest**

```json
{
  "id": "admin-base",
  "version": "1.0.0",
  "client": {
    "extensionPoints": [
      { "point": "admin.dashboard.section", "exportName": "LicenseAndTelemetryCard", "priority": 100 },
      { "point": "admin.system", "exportName": "RuntimeInfoCard", "priority": 100 }
    ]
  }
}
```

- [ ] **Step 2: Client exports**

```tsx
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LicenseAndTelemetryCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>License & telemetry</CardTitle>
        <CardDescription>Community edition — display-only. Telemetry configurable in System → Settings.</CardDescription>
      </CardHeader>
      <CardContent><p className="text-muted-foreground text-sm">No license install required.</p></CardContent>
    </Card>
  );
}

export function RuntimeInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime</CardTitle>
        <CardDescription>Generated by the admin-base plugin.</CardDescription>
      </CardHeader>
      <CardContent><p className="text-muted-foreground text-sm">Engine + JVM details visible in Diagnostics.</p></CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Register in registry**

```ts
import adminBaseManifest from "@/../plugins/admin-base/plugin.json";
import * as adminBaseClient from "@/../plugins/admin-base/client";

PLUGINS.push({ manifest: adminBaseManifest as PluginManifest, clientExports: adminBaseClient as unknown as RegisteredPlugin["clientExports"] });
```

- [ ] **Step 4: Commit**

```bash
git add plugins/admin-base src/lib/plugins/registry.ts
git commit -m "feat(plugin): admin-base (dashboard + system slot adapters)"
```

---

## Task 21: E2E — users CRUD

**Files:**
- Create: `e2e/admin-users-crud.spec.ts`

- [ ] **Step 1: Spec**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-3 admin users crud", () => {
  test("create, edit profile, change password, add to a group, delete", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    const userId = `e2e-${Date.now()}`;

    await page.goto("/admin/users/new");
    await page.getByLabel("User ID").fill(userId);
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("User");
    await page.getByLabel("Password", { exact: true }).fill("pass");
    await page.getByLabel("Confirm password").fill("pass");
    await page.getByRole("button", { name: /create user/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/users/${userId}`));
    await page.getByLabel("First name").fill("Edited");
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible();

    // Add to camunda-admin group
    await page.goto(`/admin/users/${userId}?section=groups`);
    await page.getByPlaceholder("group id").fill("camunda-admin");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("camunda-admin")).toBeVisible();

    // Delete
    await page.goto(`/admin/users/${userId}?section=danger`);
    await page.getByLabel("Confirmation").fill(userId);
    await page.getByRole("button", { name: /delete user/i }).click();
    await expect(page).toHaveURL("/admin/users");
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/admin-users-crud.spec.ts
git commit -m "test(admin): @phase-3 users CRUD e2e"
```

---

## Task 22: E2E — groups + tenants + auth + system + setup

**Files:**
- Create: `e2e/admin-groups-crud.spec.ts`
- Create: `e2e/admin-tenants-crud.spec.ts`
- Create: `e2e/admin-authorizations-crud.spec.ts`
- Create: `e2e/admin-system-info.spec.ts`
- Create: `e2e/admin-setup-wizard.spec.ts`

- [ ] **Step 1: Groups CRUD — same shape as users**

- [ ] **Step 2: Tenants CRUD — same shape**

- [ ] **Step 3: Authorizations**

```ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./_fixtures";

test.describe("@phase-3 admin authorizations", () => {
  test("create + delete", async ({ page }) => {
    await loginAs(page, "demo", "demo");
    await page.goto("/admin/authorizations/new");
    await page.getByRole("combobox").nth(1).click(); // Resource type select
    await page.getByRole("option", { name: "USER" }).click();
    await page.getByLabel("Resource ID").fill("e2e-target");
    await page.getByPlaceholder("* or id").fill("demo");
    await page.getByRole("button", { name: /create/i }).click();

    await expect(page).toHaveURL("/admin/authorizations");
    await expect(page.getByText("e2e-target").first()).toBeVisible();
  });
});
```

- [ ] **Step 4: System info**

Minimal smoke — visit `/admin/system`, assert version cell renders.

- [ ] **Step 5: Setup wizard**

Requires resettable setup — skip if the test runner cannot reset; in that case run as a `test.fixme` and document the gap in evidence/phase-3/.

```ts
import { test, expect } from "@playwright/test";

test.describe("@phase-3 admin setup", () => {
  test.fixme(true, "Requires resettable engine for first-run state — see DevOps notes.");
  test("creates first admin via the wizard", async ({ page }) => {
    await page.goto("/admin/setup");
    await page.getByLabel("User ID").fill("first-admin");
    await page.getByLabel("First name").fill("First");
    await page.getByLabel("Last name").fill("Admin");
    await page.getByLabel("Password", { exact: true }).fill("first-pass");
    await page.getByLabel("Confirm").fill("first-pass");
    await page.getByRole("button", { name: /create administrator/i }).click();
    await expect(page).toHaveURL("/login");
  });
});
```

- [ ] **Step 6: Commit (one per file or batch)**

```bash
git add e2e/admin-*.spec.ts
git commit -m "test(admin): @phase-3 e2e suite"
```

---

## Task 23: Run the full @phase-3 suite + screenshots

**Files:** none (DevOps handoff)

- [ ] **Step 1: Run**

DevOps: `npx playwright test --grep @phase-3 --project=chromium,firefox,webkit`. Address red tests by patching the offending plan task — never bypass.

- [ ] **Step 2: Manual smoke + screenshots**

```
docs/superpowers/specs/evidence/phase-3/
  ├── dashboard.png
  ├── user-detail-profile.png
  ├── user-detail-groups.png
  ├── group-detail.png
  ├── tenant-detail.png
  ├── authorization-list.png
  ├── authorization-create.png
  ├── system-info.png
  ├── system-settings.png
  ├── diagnostics.png
  ├── execution-metrics.png
  └── setup-wizard.png
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/evidence/phase-3
git commit -m "docs(phase-3): manual smoke screenshots"
```

---

## Task 24: Phase 3 exit checklist

**Files:** none

- [ ] **Step 1: Walk roadmap §4.3**

Verify every ⬜ row is now ✅ or 🚫. Reference task IDs.

- [ ] **Step 2: Distro routing flip**

DevOps: update distro proxy config so `/camunda/app/admin/*` routes to Next under `--ui both`. Re-run smoke.

- [ ] **Step 3: Final exit commit + roadmap update**

```bash
git commit --allow-empty -m "phase-3: admin cutover exit — all §4.3 rows shipped"
```

Patch roadmap §4.3 inventory: ⬜ → ✅ for every row.
