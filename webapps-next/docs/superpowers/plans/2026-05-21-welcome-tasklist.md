# Welcome + Tasklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two server-rendered pages to `webapps-next` — `/welcome` (personalized app launcher with at-a-glance task counts) and `/tasklist` (read-only inbox of the current user's open tasks) — completing the post-login navigation.

**Architecture:** React Server Components under the existing `(app)` route group; data via the existing `engineGet<T>` helper in `src/lib/camunda/engine.ts`; username via the existing `getSession()` in `src/lib/auth/session.ts`; shadcn primitives only; one shared Playwright login fixture; one e2e spec per page asserting heading + key landmark.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript 5.9, Tailwind 4, shadcn/ui, `date-fns` (already a dep), Playwright (already configured).

**Spec:** [`docs/superpowers/specs/2026-05-21-welcome-tasklist-design.md`](../specs/2026-05-21-welcome-tasklist-design.md)

---

## Constraints binding this plan

- **Orchestrator must NOT auto-commit.** Per the user's global instructions, commit commands in this plan are provided for the implementer to *show the user* and have the user run, OR for the implementer to run only after the user explicitly says "commit." Default behavior: stop after each task, summarize the diff, wait for user direction.
- **Camunda formation roles:**
  - **FE agent** owns every file under `webapps-next/src/**` and `webapps-next/e2e/**`.
  - **BE agent** owns Java; only Task 1 requires BE (read-only confirmation, no code change).
  - **DevOps agent** runs every `npm` / `npx playwright` invocation. FE never runs them.
- **Engine prerequisite:** the Camunda Run distro must be live on `localhost:8080` for Playwright tests to pass. The earlier liveness check confirmed it is (PID 87242, engine-rest 200). If a test run shows "Engine unreachable" universally, DevOps verifies the engine before retrying.
- **Authentication for tests:** Camunda Run default admin is `demo` / `demo`. The login form posts to `/api/auth/login` which calls `identityVerify(...)` against engine-rest.

---

## File Structure

**Net-new:**

| File | Responsibility |
|---|---|
| `webapps-next/src/app/(app)/welcome/page.tsx` | Welcome page server component: greeting, two task-count stat cards, three app launcher cards. |
| `webapps-next/src/app/(app)/tasklist/page.tsx` | Tasklist page server component: heading, assignee filter pill, read-only table of `GET /task?assignee={username}` with empty + engine-unreachable states. |
| `webapps-next/e2e/_fixtures.ts` | Playwright fixture: a `loginAs(page, username, password)` helper used by every spec that needs an authenticated session. |
| `webapps-next/e2e/welcome.spec.ts` | Welcome page e2e: asserts greeting and three launcher links. |
| `webapps-next/e2e/tasklist.spec.ts` | Tasklist page e2e: asserts heading and assignee filter pill (no row-count assertion — engine state may vary). |

**Modified:**

| File | Change |
|---|---|
| `webapps-next/src/components/app-shell/nav-items.ts` | Prepend a `"Welcome"` section with one item (`{ title: "Home", url: "/welcome", icon: Home }`). |

**Not touched (explicit):** `engine.ts`, `session.ts`, `proxy.ts`, `(app)/layout.tsx`, any shadcn primitive, any Java file.

---

## Task 1: Confirm `GET /task` response field names with BE

**Files:** none (read-only investigation, no code change)

- [ ] **Step 1: Dispatch BE persona to grep `engine-rest` source**

Orchestrator dispatches a `general-purpose` agent with the BE persona pasted in, with this task:

> Read-only investigation. Find the JAX-RS resource and DTO that back `GET /task` and `GET /task/count` in `engine-rest/engine-rest/src/main/java/org/camunda/bpm/engine/rest/`. Report:
> 1. The DTO class name and exact field names + Java types for: `id`, `name`, `assignee`, `created`, `due`, `followUp`, `priority`, `processDefinitionId`, `processInstanceId`.
> 2. Which fields are `@JsonInclude(NON_NULL)` / nullable in the JSON output.
> 3. Whether `GET /task/count` accepts `assignee=` as a query param with the same matching semantics as `GET /task?assignee=`.
> Do NOT edit anything.

Expected outcome: BE confirms the 9 field names match, identifies which are nullable, and confirms `/task/count?assignee=` works.

- [ ] **Step 2: Record findings**

The orchestrator records BE's report in the conversation. If any field name differs from the spec (e.g., `processDefId` instead of `processDefinitionId`), the orchestrator updates the spec AND every later task that uses that field before proceeding. If all match, continue.

**No commit at this task** — nothing changed on disk.

---

## Task 2: Add a Welcome entry to the sidebar nav

**Files:**
- Modify: `webapps-next/src/components/app-shell/nav-items.ts:1-50`

- [ ] **Step 1: Replace the file contents**

Show this exact code to the implementer (FE agent). The change adds `Home` to the icon import and prepends a `"Welcome"` section to `navSections`.

```ts
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileBox,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  PackageOpen,
  ShieldCheck,
  TableProperties,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Welcome",
    items: [{ title: "Home", url: "/welcome", icon: Home }],
  },
  {
    label: "Cockpit",
    items: [
      { title: "Dashboard", url: "/cockpit", icon: LayoutDashboard },
      { title: "Processes", url: "/cockpit/processes", icon: Workflow },
      { title: "Decisions", url: "/cockpit/decisions", icon: TableProperties },
      { title: "Tasks", url: "/cockpit/tasks", icon: ClipboardList },
      { title: "Batches", url: "/cockpit/batches", icon: Layers },
      { title: "Deployments", url: "/cockpit/deployments", icon: PackageOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Groups", url: "/admin/groups", icon: ShieldCheck },
      { title: "Authorizations", url: "/admin/authorizations", icon: FileBox },
    ],
  },
  {
    label: "Tasklist",
    items: [{ title: "Inbox", url: "/tasklist", icon: Inbox }],
  },
];
```

- [ ] **Step 2: DevOps runs Biome on the changed file**

DevOps runs:

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx biome check src/components/app-shell/nav-items.ts
```

Expected: passes (no errors).

- [ ] **Step 3: Commit (user-triggered)**

Show this command to the user; do not run unprompted:

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/src/components/app-shell/nav-items.ts
git commit -m "feat(webapps-next): add Welcome entry to sidebar nav"
```

---

## Task 3: Shared Playwright login fixture

**Files:**
- Create: `webapps-next/e2e/_fixtures.ts`

- [ ] **Step 1: Create the fixture file**

```ts
import { type Page, test as base, expect } from "@playwright/test";

type Fixtures = {
  loginAs: (username: string, password: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }: { page: Page }, use) => {
    await use(async (username: string, password: string) => {
      await page.goto("/login");
      await page.getByLabel(/^Username$/i).fill(username);
      await page.getByLabel(/^Password$/i).fill(password);
      await page.getByRole("button", { name: /^Login$/i }).click();
      // Wait until we leave /login. The middleware sends authenticated users
      // away from /login automatically.
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 10000,
      });
    });
  },
});

export { expect };
```

- [ ] **Step 2: DevOps runs Biome on the new file**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx biome check e2e/_fixtures.ts
```

Expected: passes.

- [ ] **Step 3: Commit (user-triggered)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/e2e/_fixtures.ts
git commit -m "test(webapps-next): add Playwright login fixture"
```

---

## Task 4: Welcome e2e spec (red)

**Files:**
- Create: `webapps-next/e2e/welcome.spec.ts`

- [ ] **Step 1: Write the failing e2e spec**

```ts
import { expect, test } from "./_fixtures";

test.describe("/welcome", () => {
  test("renders personalized greeting and three app launcher cards", async ({ page, loginAs }) => {
    await loginAs("demo", "demo");
    await page.goto("/welcome");

    await expect(page.getByRole("heading", { level: 1, name: /Welcome, demo/i })).toBeVisible();

    // Three launcher cards as accessible links.
    await expect(page.getByRole("link", { name: /Cockpit/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tasklist/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Admin/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: DevOps starts the Next.js dev server (if not already running)**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
lsof -i :3000 || npm run dev
```

If `lsof` returns a row, the server is already up — do not start a second one. If it's not running, start with `run_in_background: true` and wait for "Ready in".

- [ ] **Step 3: DevOps runs the e2e spec and confirms it FAILS**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx playwright test e2e/welcome.spec.ts --reporter=list
```

Expected: **FAIL** — `/welcome` returns 404 (the page does not exist yet). The exact failure message will be something like `Timed out waiting for navigation` or `404 Not Found`. Capture the failure output to confirm it's a "page missing" failure and not an unrelated infrastructure issue.

- [ ] **Step 4: Commit (user-triggered)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/e2e/welcome.spec.ts
git commit -m "test(webapps-next): add failing e2e for /welcome"
```

---

## Task 5: Welcome page implementation (green)

**Files:**
- Create: `webapps-next/src/app/(app)/welcome/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";

import { ClipboardList, ListChecks, Users, Workflow } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";
import { getSession } from "@/lib/auth/session";

type CountResponse = { count: number };

async function safeCount(path: string): Promise<number | null> {
  try {
    return (await engineGet<CountResponse>(path)).count;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const session = await getSession();
  const username = session?.username ?? "guest";

  const [myTasks, allTasks] = await Promise.all([
    safeCount(`/task/count?assignee=${encodeURIComponent(username)}`),
    safeCount("/task/count"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>
        <p className="text-muted-foreground text-sm">Camunda Platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Your open tasks"
          value={myTasks}
          description="Assigned to you"
          icon={<ListChecks className="text-muted-foreground size-4" />}
        />
        <StatCard
          title="All open tasks"
          value={allTasks}
          description="Across the engine"
          icon={<ClipboardList className="text-muted-foreground size-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <LauncherCard
          href="/cockpit"
          title="Cockpit"
          description="Process & decision administration."
          icon={<Workflow className="text-muted-foreground size-5" />}
        />
        <LauncherCard
          href="/tasklist"
          title="Tasklist"
          description="User task inbox."
          icon={<ClipboardList className="text-muted-foreground size-5" />}
        />
        <LauncherCard
          href="/admin"
          title="Admin"
          description="Users, groups, authorizations."
          icon={<Users className="text-muted-foreground size-5" />}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number | null;
  description: string;
  icon: React.ReactNode;
}) {
  const display = value === null ? "—" : new Intl.NumberFormat().format(value);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{display}</div>
        <p className="text-muted-foreground text-xs">
          {value === null ? "Engine unreachable" : description}
        </p>
      </CardContent>
    </Card>
  );
}

function LauncherCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: DevOps runs Biome on the new file**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx biome check src/app/\(app\)/welcome/page.tsx
```

Expected: passes (no errors).

- [ ] **Step 3: DevOps reruns the Welcome e2e and confirms it PASSES**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx playwright test e2e/welcome.spec.ts --reporter=list
```

Expected: **PASS** — heading and three launcher links visible.

If FAIL: report the failure output. Likely causes:
- Engine unreachable → all stat cards show "Engine unreachable" but heading and links should still pass; investigate why heading isn't visible.
- `getByRole("link", { name: /Cockpit/i })` matches the sidebar Cockpit link AND the launcher card link → both are valid; if Playwright complains about multiple matches, tighten the selector to `page.getByRole("main").getByRole("link", { name: /Cockpit/i })`.

- [ ] **Step 4: Commit (user-triggered)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/src/app/\(app\)/welcome/page.tsx
git commit -m "feat(webapps-next): add Welcome page with task counts and app launcher"
```

---

## Task 6: Tasklist e2e spec (red)

**Files:**
- Create: `webapps-next/e2e/tasklist.spec.ts`

- [ ] **Step 1: Write the failing e2e spec**

```ts
import { expect, test } from "./_fixtures";

test.describe("/tasklist", () => {
  test("renders heading and assignee filter pill", async ({ page, loginAs }) => {
    await loginAs("demo", "demo");
    await page.goto("/tasklist");

    await expect(page.getByRole("heading", { level: 1, name: /^Tasklist$/i })).toBeVisible();

    // Filter pill marks the assignee scope. Engine may or may not have tasks;
    // we don't assert row count.
    await expect(page.getByText(/Assignee:\s*demo/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: DevOps runs the spec and confirms it FAILS**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx playwright test e2e/tasklist.spec.ts --reporter=list
```

Expected: **FAIL** — `/tasklist` returns 404. Capture the failure output to confirm it's a missing-page failure.

- [ ] **Step 3: Commit (user-triggered)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/e2e/tasklist.spec.ts
git commit -m "test(webapps-next): add failing e2e for /tasklist"
```

---

## Task 7: Tasklist page implementation (green)

**Files:**
- Create: `webapps-next/src/app/(app)/tasklist/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";
import { getSession } from "@/lib/auth/session";

type TaskDto = {
  id: string;
  name: string;
  assignee: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
};

async function safeFetchTasks(username: string): Promise<TaskDto[] | null> {
  try {
    const path = `/task?assignee=${encodeURIComponent(username)}&sortBy=created&sortOrder=desc&maxResults=50`;
    return await engineGet<TaskDto[]>(path);
  } catch {
    return null;
  }
}

function processKey(id: string | null): string {
  if (!id) return "—";
  // Camunda processDefinitionId format: <key>:<version>:<deploymentId>
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}

function relative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNow(date)} ago`;
}

function absolute(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default async function TasklistPage() {
  const session = await getSession();
  const username = session?.username ?? "guest";

  const tasks = await safeFetchTasks(username);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tasklist</h1>
        <p className="text-muted-foreground text-sm">Your open user tasks</p>
      </div>

      <div>
        <Badge variant="secondary">Assignee: {username}</Badge>
      </div>

      {tasks === null ? (
        <EmptyOrErrorState message="Engine unreachable" />
      ) : tasks.length === 0 ? (
        <EmptyOrErrorState message="No tasks assigned to you." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell className="text-muted-foreground">{processKey(task.processDefinitionId)}</TableCell>
                  <TableCell>{relative(task.created)}</TableCell>
                  <TableCell>{absolute(task.due)}</TableCell>
                  <TableCell>{task.priority}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyOrErrorState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center rounded-md border text-sm">
      {message}
    </div>
  );
}
```

- [ ] **Step 2: DevOps runs Biome on the new file**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx biome check src/app/\(app\)/tasklist/page.tsx
```

Expected: passes.

- [ ] **Step 3: DevOps reruns the Tasklist e2e and confirms it PASSES**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx playwright test e2e/tasklist.spec.ts --reporter=list
```

Expected: **PASS** — heading "Tasklist" and pill "Assignee: demo" visible regardless of whether the engine has any demo tasks (engine-unreachable, empty, and happy paths all render both elements).

- [ ] **Step 4: Commit (user-triggered)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps-next/src/app/\(app\)/tasklist/page.tsx
git commit -m "feat(webapps-next): add read-only Tasklist page"
```

---

## Task 8: Final sweep — full Biome check and both e2e specs together

**Files:** none modified; verification only.

- [ ] **Step 1: DevOps runs the full Biome check across the workspace**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npm run check
```

Expected: passes. If any unrelated pre-existing warnings appear, surface them to the user (do NOT auto-fix unrelated files).

- [ ] **Step 2: DevOps runs both e2e specs back-to-back**

```
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/webapps-next
npx playwright test e2e/welcome.spec.ts e2e/tasklist.spec.ts --reporter=list
```

Expected: **both PASS**.

- [ ] **Step 3: Orchestrator summarizes to user**

Single message back to the user covering:
- The 5 net-new files + 1 modified file (list paths).
- The two test-run results.
- Any BE confirmation findings from Task 1.
- That no commits were made (per user preference) — show the prepared commit sequence and ask whether to run them.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| Architecture (cockpit pattern) | Task 5, Task 7 |
| Welcome layout (heading, stats, 3 launcher cards) | Task 5 |
| Welcome engine endpoints (`/task/count`, `/task/count?assignee=`) | Task 5 |
| Tasklist layout (heading, filter pill, table) | Task 7 |
| Tasklist columns (Name, Process, Created, Due, Priority, Action) | Task 7 |
| Tasklist endpoint (`/task?assignee=...&sortBy=created&sortOrder=desc&maxResults=50`) | Task 7 |
| Tasklist states (engine unreachable, empty, happy) | Task 7 |
| TaskDto inline | Task 7 |
| Sidebar nav update (Welcome if absent) | Task 2 |
| Cross-repo BE confirmation | Task 1 |
| DevOps handoff (restart Next.js) | Task 4 step 2 (start if not running) |
| Out-of-scope items | Honored — no task touches detail page, claim/complete, forms, filters, pagination, i18n |

No gaps found.

**Placeholder scan:** No TBD / TODO / "implement later" / "add error handling" placeholders. Every step contains complete code or an exact command with expected output.

**Type consistency:** `TaskDto` field names match between the spec, Task 7's implementation, and Task 1's BE-confirmation request. `CountResponse` is a local type alias in Task 5 only — no cross-task reference. `Session` is imported, not redefined. `processKey()` is defined once in Task 7 and not referenced elsewhere.
