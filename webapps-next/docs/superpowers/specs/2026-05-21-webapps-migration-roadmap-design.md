# Camunda webapps migration roadmap — design

**Date:** 2026-05-21
**Scope:** `camunda-bpm-platform/` — replacing `webapps/frontend/` (AngularJS UI) and the asset-shell half of `webapps/assembly/` with the Next.js rewrite in `webapps-next/`.
**Status:** Approved (pending spec review).
**Shape:** Inventory-first, parity-gated. Per-app feature tables drive phase exit criteria.

---

## 1. Summary

This is a roadmap, not an implementation plan. It captures:

- The eight load-bearing architecture decisions for `webapps-next/` (§3).
- Per-app feature inventories — every legacy page, sub-feature, plugin, REST endpoint — with status against the current `webapps-next/` (§4–§6).
- Six numbered phases with mechanical exit criteria (§7).
- Risks and open questions (§8).

Phase content is *what gets shipped and how completion is measured*. Implementation-level specs (like `2026-05-21-welcome-tasklist-design.md`) sit underneath each phase as that phase reaches execution.

### Locked decisions

| # | Decision | Detail |
|---|---|---|
| L1 | Per-app cutover | Welcome → Tasklist → Admin → Cockpit, each flips independently. |
| L2 | 100% feature parity per app before cutover | No 🟡 or ⬜ rows scoped to the cutting-over phase. |
| L3 | New plugin contract, port all bundled plugins | Legacy AngularJS plugins keep working in the legacy app until that app retires. |
| L4 | Standalone Node process inside distro | `run.sh` orchestrates Spring Boot + Next.js. Node becomes a distro prereq. |
| L5 | Cookie-based session calling `engine-rest/identity/verify` | No NextAuth, no proxied Spring Security session. |
| L6 | RSC by default, client components only when needed | Mutation pattern: server actions OR route-handler calls. |
| L7 | Polling for live data; no SSE/WebSocket | TanStack Query handles intervals + dedup. |
| L8 | `next-intl` for i18n | Migration script converts legacy `locales/{en,de}.json` to flat-key format. |

### Open questions (must resolve before affected phase starts)

| ID | Question | Affects |
|---|---|---|
| Q1 | Multi-engine support? Legacy has an engine selector. | All apps, proxy config, sidebar |
| Q2 | License key install UI? | Phase 3 (Admin) |
| Q3 | Setup wizard (first-run install)? | Phase 3 (Admin) |
| Q4 | Known third-party plugins to preserve compatibility for? | §3.3 plugin contract |

---

## 2. Current state snapshot

### `webapps-next/` shipped so far

```
src/app/
├── (app)/
│   ├── layout.tsx                       Sidebar shell, session-gated
│   ├── welcome/page.tsx                 ✅ implemented (per welcome-tasklist spec)
│   ├── tasklist/page.tsx                ✅ read-only list (claim/complete deferred)
│   ├── admin/
│   │   ├── page.tsx                     Dashboard
│   │   ├── users/page.tsx
│   │   ├── groups/page.tsx
│   │   └── authorizations/page.tsx
│   └── cockpit/
│       ├── page.tsx                     Dashboard
│       ├── processes/page.tsx           List
│       ├── processes/[key]/page.tsx     Definition (runtime view + activity badges)
│       ├── processes/[key]/instances/[id]/page.tsx  Instance (bpmn-js + cargotrain heatmap)
│       ├── decisions/page.tsx
│       ├── deployments/page.tsx
│       ├── batches/page.tsx
│       └── tasks/page.tsx
├── api/auth/{login,logout}/route.ts
├── login/page.tsx
└── page.tsx                              Root redirect
```

Plus `src/lib/camunda/engine.ts` (`engineGet<T>`, `identityVerify`), `src/lib/auth/session.ts`, `src/proxy.ts` middleware, full shadcn UI primitives, `bpmn-js`/`dmn-js`/`form-js` dependencies, Playwright + Biome wired.

The `plugins/` and `plugins-samples/` directories at the repo root are empty.

### Legacy modules in play

| Path | Role | Disposition |
|---|---|---|
| `webapps/frontend/ui/{cockpit,tasklist,admin,welcome}/` | AngularJS UI source | **Deleted in Phase 5** |
| `webapps/frontend/locales/{en,de}.json` | i18n strings | **Migrated in Phase 0** (script converts to next-intl flat keys) |
| `webapps/frontend/ui/common/` + `webapps/frontend/camunda-commons-ui/` | shared AngularJS components | Deleted in Phase 5 |
| `webapps/assembly/src/main/java/` | Spring REST endpoints + asset shell | **Split in Phase 0:** API module stays, asset-serving shell deleted in Phase 5 |
| `webapps/assembly-jakarta/` | Jakarta-EE variant of assembly | Same split as `assembly/` |
| `distro/run/assembly/resources/run.sh` + `run.bat` | Distro launcher | **Extended in Phase 0** with `--ui {legacy|next|both}` flag |

---

## 3. Locked architecture decisions

Each subsection: rationale, chosen design, rejected alternatives, owning files today.

### 3.1 Auth & session

**Decision.** Signed cookie session. Login route POSTs to `engine-rest/identity/verify`; on success it encodes `{username, groups[]}` into a signed cookie. Middleware (`src/proxy.ts`) redirects unauthenticated traffic to `/login`. Logout clears the cookie.

**Files.** `src/lib/auth/session.ts`, `src/app/api/auth/{login,logout}/route.ts`, `src/proxy.ts`.

**Rejected.** NextAuth (too heavy for one credentials provider; adds 200kb + DB dependency we don't need). Proxied Spring Security session (couples session lifecycles, breaks if legacy assembly is restarted, complicates side-by-side cutover window).

**Phase 0 hardening.**
- CSRF token on every state-changing route handler. Token stored alongside session; verified in middleware for `POST/PUT/DELETE`.
- Idle timeout on the cookie (default 30 min, configurable via env). Activity refreshes the cookie expiration.
- `groups[]` claim added to the cookie so client components can show/hide actions without a server round-trip. Authorization checks for *mutations* still happen server-side against `engine-rest`.

### 3.2 Engine-REST + webapp-REST proxy

**Decision.** `next.config.mjs` rewrites four base paths to the Spring Boot engine host:

| Next-side path | Spring Boot target | Source |
|---|---|---|
| `/api/engine/*` | `${ENGINE_HOST}/engine-rest/*` | `engine-rest/` Java module |
| `/api/cockpit/*` | `${ENGINE_HOST}/api/cockpit/*` | `webapps/assembly` (post-split: webapp-rest module) |
| `/api/admin/*` | `${ENGINE_HOST}/api/admin/*` | same |
| `/api/tasklist/*` | `${ENGINE_HOST}/api/tasklist/*` | same |

`ENGINE_HOST` is one env var; default `http://localhost:8080`.

**Rejected.** Re-implementing the webapp-REST endpoints in Node (would require porting Camunda Java services to TypeScript — out of scope and lose engine-internal access). Bundling everything through `engine-rest` (would require BE changes to add new REST resources, which CLAUDE.md flags as `Public API change` requiring user approval per resource).

**Phase 0 dependency.** The `webapps/assembly` split into "API module (stays)" + "static-asset shell (deleted Phase 5)" — see §3.4. Until that split exists, all four rewrites point at the same Spring Boot host that today serves both.

### 3.3 Plugin contract

**Decision.** New `plugin.json`-based contract. Each plugin lives in `webapps-next/plugins/<id>/`:

```json
{
  "id": "cockpit.processStatistics",
  "app": "cockpit",
  "slot": "cockpit.processDefinition.runtime.tab",
  "label": { "en": "Statistics", "de": "Statistiken" },
  "entry": "./client.tsx",
  "server": "./server.ts",
  "priority": 100
}
```

**Discovery.** Build-time scan of `webapps-next/plugins/*/plugin.json` produces a generated module `src/lib/plugins/registry.ts` mapping slot id → array of `{import, label, priority}` entries.

**Slots.** React components named after each slot id. Each slot accepts registered plugin components as children, sorted by `priority`. Slot catalog populated by Phase 0 from the legacy `ViewsProvider.registerDefaultView(...)` enumeration (§5 below).

**Server entries (optional).** If `server` is present, that module's named exports get mounted as Next route handlers under `/api/plugin/<id>/*` (one handler per exported method).

**Optional schema fields.** Plugins may declare additional metadata keys:
- `priority: number` — ordering within a slot (lower first).
- `pollIntervalMs: number` — override of the default polling cadence (§3.7) for any widget the plugin renders.
- `requiredGroups: string[]` — only mount the plugin if the session's `groups[]` claim (§3.1) intersects.

Unknown keys are ignored (forward-compat).

**Third-party plugins.** Same `plugin.json` shape; dropped into `webapps-next/plugins/` before build. Hot-load at runtime is out of scope — plugins are part of the build (matches legacy behavior where AngularJS plugins were also build-time bundled).

**Rejected.**
- Runtime AngularJS shim — embed an AngularJS bootstrap inside a Next route segment so legacy plugins run unchanged. Carries the entire AngularJS runtime forever; undermines RSC; nullifies the rewrite's value.
- Webpack Module Federation — overkill for a first-party plugin set of ~15 plugins. Build-time scan is simpler and ships less code.
- Defer plugin design — contradicts L2 (100% parity per app before cutover); apps cannot flip with their plugins missing.

**Q4 dependency.** If specific third-party plugins are known to need migration, their extension points get added to the slot catalog before Phase 4.

### 3.4 Distro packaging

**Decision.** `distro/run/distro/` adds a `webapps-next/` directory containing the Next.js standalone build output (`.next/standalone/` + `public/` + `static/`). `run.sh` / `run.bat` gain a `--ui` flag with values:

- `legacy` — current behavior, serves `webapps/assembly` only.
- `next` — boots Next.js standalone on a private port; Spring Boot reverse-proxies `/camunda/app/*` to it.
- `both` — boots both; reverse-proxy routes per-app based on per-phase distro config (see L1 per-app cutover).

`--ui legacy` is the default during migration. Default flips to `next` after Phase 4 exit criteria pass. `--ui both` is the cutover window mode used during each phase's flip.

**Node prerequisite.** Documented in the README + run-distro README. Stated minimum Node version pinned in Phase 0.

**Webapps/assembly split.** Phase 0 splits `webapps/assembly` into:
- `webapps/webapp-rest/` (new module) — keeps all `@Path` resources (the `/api/{cockpit,admin,tasklist,welcome}/*` Spring endpoints, `UserAuthenticationResource`, `/setup/{engine}`, metrics, plugin REST proxies). Mounted by the engine regardless of `--ui` flag.
- `webapps/assembly/` (becomes legacy-only) — the static-asset serving + filter chain + AngularJS bundle. Deleted in Phase 5.

**Rejected.**
- Static export (`output: 'export'`) served by Spring — kills RSC, kills route handlers, forces every page to be a client component (a major regression from the current implementation pattern).
- Separate Docker image only — bifurcates the user base; bare-metal distro users would stay on legacy forever.
- Single combined jar that includes Node runtime — adds platform-specific binaries to the Java jar; portability nightmare.

### 3.5 RSC + client-component split

**Default: server components.** The pattern is set by `src/app/(app)/cockpit/page.tsx` — server component, `Promise.all(engineGet(...))`, `safeCount` fallback, shadcn render. Mirror this for new pages.

**Use `"use client"` when:**
- Interactive form rendering (`@bpmn-io/form-js`) — needs DOM + event handlers.
- Diagram rendering / interaction (`bpmn-js`, `dmn-js`) — instantiates against a DOM node.
- Mutations with optimistic UI (claim/complete task, retry incident, etc.).
- Filters / search / pagination with no SSR benefit.

**Three-rule guide for new pages:**
1. If the page never accepts user input that mutates engine state → server component, no exceptions.
2. If the page has a non-trivial form or canvas widget → keep the page itself a server component; isolate the interactive piece into a client component imported as a child.
3. Mutation routes: either a `'use server'` action or a `/api/...` route handler. Pick the route handler when the action is also called from a plugin or another app surface.

### 3.6 i18n

**Decision.** `next-intl`. Source files at `webapps-next/messages/{en,de}.json`.

**Migration.** Phase 0 ships a one-shot script `webapps-next/scripts/migrate-locales.mjs`:
- Reads `webapps/frontend/public/app/{cockpit,admin,tasklist,welcome}/locales/{en,de}.json`.
- Flattens AngularJS-style nested paths (e.g. `PAGES.PROCESS_INSTANCE.HEADER`) to next-intl namespaces.
- Writes merged output to `webapps-next/messages/{en,de}.json`.
- Reports collision keys; manual resolution in the merge commit.

Strings added during Phases 1–4 land directly in the new files. The legacy locale files are not edited further; they freeze at Phase 0.

Locale switching uses next-intl's middleware integration with our existing `src/proxy.ts`.

### 3.7 Real-time

**Decision.** **Polling.** TanStack Query handles polling intervals and dedup across mounted widgets.

**Defaults:**
- List pages (`/cockpit/processes`, `/tasklist`): 10s poll, paused when tab is hidden.
- Dashboard counts: 30s poll.
- Single-resource detail (`/cockpit/processes/[key]/instances/[id]`): 5s poll while page is mounted.

**Per-widget override via plugin metadata** — a plugin's `plugin.json` can declare `pollIntervalMs` to opt into a different cadence for its slot.

**Rejected.** SSE / WebSocket — engine-rest doesn't expose either today. Adding them requires Java work outside the FE scope and BE public-API changes that need user approval per CLAUDE.md.

**Known limit.** Documented in §8 Risks. SSE is a candidate post-cutover follow-up but is *not* a phase gate; cutover happens with polling.

### 3.8 Testing

**Playwright at `webapps-next/e2e/`** against a real distro launched by DevOps. Spec naming convention: `<feature>.spec.ts`, tagged via Playwright's `test.describe` titles with `@phase-N` so phase exit criteria can run scoped subsets (`npx playwright test --grep @phase-2`).

**Unit tests via Vitest** for non-trivial logic in `src/lib/` (the locale migration script, the plugin registry build step, the proxy config). UI behavior is verified by Playwright; component-level unit tests are skipped.

**No visual regression tool in v1.** Manual screenshot diffs in PRs.

**Cross-browser scope:** Playwright runs Chromium + Firefox + WebKit. Legacy webapps were only tested in Chromium + Firefox; WebKit is a new bar.

---

## 4. Per-app feature inventories

Each inventory below uses this schema:

| Column | Content |
|---|---|
| Legacy feature | Short user-visible name |
| Legacy source | File / route / plugin id |
| Next-app location | App-router path or `—` |
| Status | ✅ shipped · 🟡 partial · ⬜ missing · 🚫 dropped (rationale required) |
| Parity gap | One line if status ≠ ✅ |
| Phase | Phase that ships this row |

**Sourcing rule.** Each app's inventory enumerates `webapps/frontend/ui/<app>/client/scripts/pages/*.js` (and plugin dirs where present). Behavioral parity is verified at phase-execution time, not roadmap-write time — these tables answer "does the feature exist?" not "does it behave identically?"

### 4.1 Welcome (Phase 1)

Source dir: `webapps/frontend/ui/welcome/client/scripts/`.

| Legacy feature | Legacy source | Next-app location | Status | Parity gap | Phase |
|---|---|---|---|---|---|
| Greeting + username | `pages/welcome.js` + `pages/welcome.html` | `src/app/(app)/welcome/page.tsx` | ✅ | — | 1 |
| App launcher cards (Cockpit/Tasklist/Admin) | `pages/welcome.html` | `src/app/(app)/welcome/page.tsx` | ✅ | — | 1 |
| At-a-glance task counts | `pages/welcome.js` | `src/app/(app)/welcome/page.tsx` | ✅ | — | 1 |
| Custom links section | `directives/custom-links.js` + `services/custom-links.js` | — | ⬜ | not yet ported; legacy reads from server config | 1 |
| User profile widget (display name, email) | `directives/user-profile.js` + `plugins/profile/user-profile.js` | — | ⬜ | not yet ported; uses `welcome.profile` plugin slot | 1 |
| Welcome plugin slot host | `plugins/main.js` (registers `welcome.profile`) | — | ⬜ | depends on plugin contract impl (§3.3) | 1 |

### 4.2 Tasklist (Phase 2)

Source dirs: `webapps/frontend/ui/tasklist/client/scripts/{tasklist,task,filter,form,controller,navigation,shortcuts}/` + `webapps/frontend/ui/tasklist/plugins/`.

| Legacy feature | Legacy source | Next-app location | Status | Parity gap | Phase |
|---|---|---|---|---|---|
| Task list (assignee = current user) | `tasklist/` controllers + `controller/cam-tasklist-app-ctrl.js` | `src/app/(app)/tasklist/page.tsx` | ✅ | — | 2 |
| Task detail page | `task/controller/` + `task/directives/` | — | ⬜ | not yet ported; needs `/tasklist/[id]` route | 2 |
| Claim / unclaim task | `task/directives/` | — | ⬜ | needs client component + POST route handler | 2 |
| Complete task | `task/directives/` + `form/` | — | ⬜ | requires form rendering | 2 |
| Form rendering (embedded forms, external forms, generic variables) | `form/directives/` | — | ⬜ | `@bpmn-io/form-js` already a dep; integration not wired | 2 |
| Task variables editor | `task/directives/` (variables tab) | — | ⬜ | not yet ported | 2 |
| Identity links (candidate users/groups) | `task/directives/` | — | ⬜ | not yet ported | 2 |
| Task comments | `task/directives/` | — | ⬜ | not yet ported | 2 |
| Task history | `task/directives/` | — | ⬜ | not yet ported | 2 |
| Task attachments | `task/directives/` | — | ⬜ | not yet ported | 2 |
| Filters (saved filters, candidate-group, search) | `filter/` | — | ⬜ | substantial: filter editor + filter list panel | 2 |
| Filter editor modal | `filter/modals/` | — | ⬜ | not yet ported | 2 |
| Sort controls (built-in + tasklistSorting plugin) | `plugins/tasklistSorting/` | — | ⬜ | plugin slot `tasklist.list` | 2 |
| Tasklist card plugin | `plugins/tasklistCard/` | — | ⬜ | plugin slot `tasklist.card` | 2 |
| Standalone task creation | `plugins/standaloneTask/` | — | ⬜ | plugin slot `tasklist.navbar.action` | 2 |
| Keyboard shortcuts | `shortcuts/` | — | ⬜ | not yet ported; consider whether 🚫 dropped | 2 |
| Navigation (multi-process-engine selector) | `navigation/` | — | ⬜ | gated on Q1 (multi-engine?) | 2 |

### 4.3 Admin (Phase 3)

Source dir: `webapps/frontend/ui/admin/client/scripts/pages/` (21 page files).

| Legacy feature | Legacy source | Next-app location | Status | Parity gap | Phase |
|---|---|---|---|---|---|
| Dashboard | `dashboard.js` | `src/app/(app)/admin/page.tsx` | ✅ | — | 3 |
| Users list | `users.js` | `src/app/(app)/admin/users/page.tsx` | ✅ | — | 3 |
| User create | `userCreate.js` | — | ⬜ | needs form + POST to `engine-rest/user/create` | 3 |
| User edit (profile, password, groups) | `userEdit.js` | — | ⬜ | not yet ported | 3 |
| Groups list | `groups.js` | `src/app/(app)/admin/groups/page.tsx` | ✅ | — | 3 |
| Group create | `groupCreate.js` | — | ⬜ | not yet ported | 3 |
| Group edit | `groupEdit.js` | — | ⬜ | not yet ported | 3 |
| Group membership management | `groupMembershipsCreate.js` | — | ⬜ | not yet ported | 3 |
| Tenants list | `tenants.js` | — | ⬜ | gated on Q1 (multi-tenant) | 3 |
| Tenant create | `tenantCreate.js` | — | ⬜ | gated on Q1 | 3 |
| Tenant edit | `tenantEdit.js` | — | ⬜ | gated on Q1 | 3 |
| Tenant memberships create | `tenantMembershipsCreate.js` | — | ⬜ | gated on Q1 | 3 |
| Authorizations list | `authorizations.js` | `src/app/(app)/admin/authorizations/page.tsx` | ✅ | — | 3 |
| Authorization create | `authorizationCreate.js` | — | ⬜ | not yet ported | 3 |
| Authorization delete confirm | `authorizationDeleteConfirm.js` | — | ⬜ | not yet ported | 3 |
| System info | `system.js` | — | ⬜ | not yet ported | 3 |
| System settings — general | `systemSettingsGeneral.js` | — | ⬜ | not yet ported; gated on Q2 (license) | 3 |
| Diagnostics | `diagnostics.js` | — | ⬜ | gated on Q2 (license + telemetry UI) | 3 |
| Execution metrics | `execution-metrics.js` | — | ⬜ | reads `/api/admin/plugin/adminPlugins/metrics/aggregated` | 3 |
| Setup wizard (first-run install) | `setup.js` | — | ⬜ → 🚫? | gated on Q3 — recommended 🚫 dropped (modern distros pre-seed demo user) | 3 |
| Main / app shell | `main.js` | `src/app/(app)/admin/layout.tsx` (implicit via app shell) | ✅ | — | 3 |
| Admin base plugin | `webapps/frontend/ui/admin/plugins/base/` | — | ⬜ | depends on plugin contract impl; slot ids `admin.dashboard.section`, `admin.system` | 3 |

### 4.4 Cockpit (Phase 4)

Source dir: `webapps/frontend/ui/cockpit/client/scripts/pages/` (9 page files) + `webapps/frontend/ui/cockpit/plugins/` (5 plugin dirs).

| Legacy feature | Legacy source | Next-app location | Status | Parity gap | Phase |
|---|---|---|---|---|---|
| Dashboard (welcome card + plugin sections) | `pages/dashboard.js` | `src/app/(app)/cockpit/page.tsx` | 🟡 | dashboard plugin slots (`cockpit.processes.dashboard`, `cockpit.decisions.dashboard`, `cockpit.tasks.dashboard`) not yet wired | 4 |
| Processes — definition list | `pages/processes.js` | `src/app/(app)/cockpit/processes/page.tsx` | 🟡 | running-instance count column missing (requires `/api/cockpit/process-definition/statistics`) | 4 |
| Process definition page — runtime view | `pages/processDefinition.js` (view `cockpit.processDefinition.view#runtime`) | `src/app/(app)/cockpit/processes/[key]/page.tsx` | 🟡 | activity badges shipped; diagram interactions partial | 4 |
| Process definition — runtime tab: process-instances table | plugin `base/views/processDefinition/processInstanceTable.js` | — | ⬜ | tab slot `cockpit.processDefinition.runtime.tab` | 4 |
| Process definition — runtime tab: incidents | plugin `base/views/processDefinition/pdIncidentsTab.js` | — | ⬜ | tab slot `cockpit.processDefinition.runtime.tab` | 4 |
| Process definition — runtime tab: job definitions | plugin `jobDefinition/views/processDefinition/jobDefinitionTable.js` | — | ⬜ | tab slot `cockpit.processDefinition.runtime.tab` | 4 |
| Process definition — runtime tab: called process definitions | plugin `base/views/processDefinition/` | — | ⬜ | tab slot | 4 |
| Process definition — history view (history tab) | `pages/processDefinition.js` (view `cockpit.processDefinition.view#history`) | — | ⬜ | not yet ported | 4 |
| Process definition — actions: suspend/activate, update job priority | plugin `jobDefinition/actions/` + `base/views/processDefinition/updateSuspensionStateAction.js` | — | ⬜ | action slots | 4 |
| Process instance page — diagram + activity highlights | `pages/processInstance.js` | `src/app/(app)/cockpit/processes/[key]/instances/[id]/page.tsx` | 🟡 | bpmn-js + cargotrain heatmap shipped; interaction-driven sub-tabs missing | 4 |
| Process instance — runtime tab: variables | plugin `base/views/processInstance/variableInstancesTab.js` | — | ⬜ | tab slot `cockpit.processInstance.runtime.tab` | 4 |
| Process instance — runtime tab: incidents | plugin `base/views/processInstance/incidentsTab.js` | — | ⬜ | tab slot | 4 |
| Process instance — runtime tab: called process instances | plugin `base/views/processInstance/calledProcessInstanceTable.js` | — | ⬜ | tab slot | 4 |
| Process instance — runtime tab: user tasks | plugin `base/views/processInstance/userTasksTable.js` | — | ⬜ | tab slot | 4 |
| Process instance — runtime tab: jobs | plugin `base/views/processInstance/jobsTab.js` | — | ⬜ | tab slot | 4 |
| Process instance — runtime tab: external tasks | plugin `external-tasks-process-instance-runtime-tab/` | — | ⬜ | tab slot | 4 |
| Process instance — history view | `pages/processInstance.js` (history view) | — | ⬜ | not yet ported | 4 |
| Process instance — actions: cancel, add variable, retry job, update suspension, retry external task | plugin `base/views/processInstance/*Action.js` | — | ⬜ | action slots `cockpit.processInstance.runtime.action`, `cockpit.incident.action` | 4 |
| Process instance — diagram overlays: instance count, call activity | plugin `base/views/{processDefinition,processInstance}/diagramPlugins/` + `jobDefinition/views/processDefinition/diagramPlugins/jobSuspension.js` | — | ⬜ | diagram overlay slots | 4 |
| Decisions — definition list | `pages/decisions.js` | `src/app/(app)/cockpit/decisions/page.tsx` | 🟡 | running counts + plugin slot `cockpit.decisions.dashboard` not wired | 4 |
| Decision definition page | `pages/decisionDefinition.js` (view `cockpit.decisionDefinition.view`) | — | ⬜ | dmn-js rendering not yet wired | 4 |
| Decision definition — tabs | tab slot `cockpit.decisionDefinition.tab` | — | ⬜ | not yet ported | 4 |
| Decision instance page | `pages/decisionInstance.js` (view `cockpit.decisionInstance.view`) | — | ⬜ | dmn-js + evaluation tree | 4 |
| Decision instance — tabs + table | slots `cockpit.decisionInstance.tab`, `cockpit.decisionInstance.table` | — | ⬜ | not yet ported | 4 |
| Deployments | `pages/processes.js` + repository plugin slots | `src/app/(app)/cockpit/deployments/page.tsx` | 🟡 | deployment delete + resource detail + redeploy actions missing (slots `cockpit.repository.deployment.action`, `cockpit.repository.resource.action`, `cockpit.repository.resource.detail`) | 4 |
| Batches | `pages/main.js` (Batch route + dashboard sections) | `src/app/(app)/cockpit/batches/page.tsx` | 🟡 | batch detail + retry/delete actions missing | 4 |
| Tasks dashboard (Cockpit view, not Tasklist) | `pages/tasks.js` + plugin `tasks/` (`cockpit.tasks.dashboard`) | `src/app/(app)/cockpit/tasks/page.tsx` | 🟡 | dashboard widgets via plugin slot not wired | 4 |
| Sidebar navigation extensions | slot `cockpit.navigation` | — | ⬜ | nav-items system already exists; plugin extension not wired | 4 |
| Search bar (global) | scattered in `pages/*.js` | — | ⬜ | not yet ported | 4 |
| Engine selector | scattered | — | ⬜ | gated on Q1 | 4 |

---

## 5. Plugin inventory

Per legacy plugin: dir, the slot(s) it registers into, and the corresponding new-contract `plugin.json` path.

### 5.1 Cockpit slot catalog (from `ViewsProvider.registerDefaultView(...)` scan)

| Slot id | Purpose |
|---|---|
| `cockpit.navigation` | Sidebar nav extension |
| `cockpit.processes.dashboard` | Processes dashboard widgets |
| `cockpit.decisions.dashboard` | Decisions dashboard widgets |
| `cockpit.tasks.dashboard` | Tasks dashboard widgets (Cockpit-internal) |
| `cockpit.processDefinition.view` | Process definition page view container (runtime/history) |
| `cockpit.processDefinition.runtime.tab` | Tabs on process definition runtime view |
| `cockpit.processInstance.view` | Process instance page view container |
| `cockpit.processInstance.runtime.tab` | Tabs on process instance runtime view |
| `cockpit.processInstance.runtime.action` | Actions in the process instance toolbar |
| `cockpit.decisionDefinition.view` | Decision definition page view container |
| `cockpit.decisionDefinition.tab` | Tabs on decision definition |
| `cockpit.decisionInstance.view` | Decision instance page view container |
| `cockpit.decisionInstance.tab` | Tabs on decision instance |
| `cockpit.decisionInstance.table` | Decision instance result table cells |
| `cockpit.incident.action` | Actions in incident rows |
| `cockpit.jobDefinition.action` | Actions in job definition rows |
| `cockpit.repository.deployment.action` | Actions on deployments |
| `cockpit.repository.resource.action` | Actions on a deployment resource |
| `cockpit.repository.resource.detail` | Detail panel for a deployment resource |

### 5.2 Tasklist + Admin + Welcome slot catalog

| App | Slot id | Purpose |
|---|---|---|
| Tasklist | `tasklist.card` | Per-task list card content |
| Tasklist | `tasklist.header` | Tasklist header area |
| Tasklist | `tasklist.list` | List-level widgets (sort, filters) |
| Tasklist | `tasklist.navbar.action` | Navbar action buttons |
| Tasklist | `tasklist.task.action` | Per-task action buttons |
| Tasklist | `tasklist.task.detail` | Task detail panel widgets |
| Admin | `admin.dashboard.section` | Dashboard sections |
| Admin | `admin.system` | System info sections |
| Welcome | `welcome.profile` | User profile widget |

### 5.3 Bundled plugins to port

| Plugin | Legacy dir | Registers into | New plugin.json | Phase |
|---|---|---|---|---|
| `cockpit-base` | `webapps/frontend/ui/cockpit/plugins/base/` | Many slots (process-instance/definition tabs + actions + diagram overlays + incident actions) | `plugins/cockpit-base/plugin.json` | 4 |
| `cockpit-decision-list` | `webapps/frontend/ui/cockpit/plugins/decisionList/` | `cockpit.decisions.dashboard` | `plugins/cockpit-decision-list/plugin.json` | 4 |
| `cockpit-external-tasks-runtime-tab` | `webapps/frontend/ui/cockpit/plugins/external-tasks-process-instance-runtime-tab/` | `cockpit.processInstance.runtime.tab` | `plugins/cockpit-external-tasks-tab/plugin.json` | 4 |
| `cockpit-job-definition` | `webapps/frontend/ui/cockpit/plugins/jobDefinition/` | `cockpit.processDefinition.runtime.tab` + `cockpit.jobDefinition.action` + diagram plugins | `plugins/cockpit-job-definition/plugin.json` | 4 |
| `cockpit-tasks-dashboard` | `webapps/frontend/ui/cockpit/plugins/tasks/` | `cockpit.tasks.dashboard` | `plugins/cockpit-tasks-dashboard/plugin.json` | 4 |
| `tasklist-sorting` | `webapps/frontend/ui/tasklist/plugins/tasklistSorting/` | `tasklist.list` | `plugins/tasklist-sorting/plugin.json` | 2 |
| `tasklist-card` | `webapps/frontend/ui/tasklist/plugins/tasklistCard/` | `tasklist.card` | `plugins/tasklist-card/plugin.json` | 2 |
| `tasklist-standalone-task` | `webapps/frontend/ui/tasklist/plugins/standaloneTask/` | `tasklist.navbar.action` | `plugins/tasklist-standalone-task/plugin.json` | 2 |
| `admin-base` | `webapps/frontend/ui/admin/plugins/base/` | `admin.dashboard.section`, `admin.system` | `plugins/admin-base/plugin.json` | 3 |

The `cockpit-base` plugin is the largest single port (~15 views split across multiple slot ids). Phase 4 plan-phase spec will likely break it into smaller new plugins along slot boundaries.

---

## 6. Custom webapp-REST endpoints inventory

These are the non-`engine-rest` Spring endpoints served by `webapps/assembly` today. They survive Phase 5 (in the new `webapps/webapp-rest/` module — see §3.4). webapps-next reaches them via the proxy rewrites in §3.2.

| Path | Source class | Used by |
|---|---|---|
| `/api/admin/auth/user/{engine}` | `UserAuthenticationResource.getAuthenticatedUser` | Webapp session check (currently unused by next; replaced by cookie session) |
| `/api/admin/auth/user/{engine}/login/{appName}` | `UserAuthenticationResource.doLogin` | Legacy login form |
| `/api/admin/auth/user/{engine}/logout` | `UserAuthenticationResource.doLogout` | Legacy logout |
| `/api/admin/setup/{engine}/user/create` | `SetupResource.createInitialUser` | First-run install (gated on Q3) |
| `/api/admin/plugin/adminPlugins/{engine}/metrics/aggregated` | `MetricsRestService` | Admin execution metrics page |
| `/api/cockpit/...` | Cockpit plugin REST resources (registered via `CockpitRuntimeDelegate`) | Cockpit pages — process statistics, batch detail, called-process drill-down, etc. |
| `/api/tasklist/...` | Tasklist plugin REST resources (`AbstractTasklistPluginResource`) | Tasklist pages — custom filters, candidate-group queries |
| `/api/welcome/...` | `WelcomeRuntimeDelegate` resources | Welcome custom links (gated on Q1 for multi-engine context) |
| `/api/<app>/plugin/static/{file}` | Plugin static asset serving (`AbstractPluginRootResource.getAsset`) | Legacy plugin static assets — **🚫 dropped post-cutover**; webapps-next plugins ship their assets via Next's `public/` |

**Phase 0 task:** enumerate every `@Path` in `webapps/assembly/src/main/java/` and confirm each maps to a row above. Rows above are the categories; the full path list lives in the Phase 0 deliverable doc.

---

## 7. Phases & exit criteria

### Phase 0 — Foundation

**Goal.** Everything needed before any app can cut over: API/asset split, plugin contract impl, distro launcher changes, auth hardening, i18n migration, Playwright harness.

**Deliverables.**
- `webapps/webapp-rest/` new Maven module — extracted from `webapps/assembly/`; serves all `@Path` resources; mounted by engine independently of `--ui` flag. ⚠️ BE handoff.
- `webapps/assembly/` slimmed to static-asset shell + filter chain only (deleted in Phase 5).
- `src/lib/plugins/registry.ts` generated module + `webapps-next/scripts/build-plugin-registry.mjs` build step + slot catalog declared in `src/lib/plugins/slots.ts` (the 28 slot ids from §5).
- One reference plugin shipped in `plugins-samples/` that registers into a known slot and verifies the registry+slot machinery.
- `next.config.mjs` rewrites extended with `/api/{cockpit,admin,tasklist,welcome}/*` (§3.2).
- `distro/run/assembly/resources/run.sh` + `run.bat` extended with `--ui {legacy|next|both}` flag. Default `legacy`.
- Spring reverse-proxy config for `--ui next`/`both` modes routing `/camunda/app/<app>/*` to Next.js.
- Auth hardening: CSRF token, idle timeout, `groups[]` claim. New tests in `e2e/auth.spec.ts`.
- `webapps-next/messages/{en,de}.json` produced by `scripts/migrate-locales.mjs`; collision log committed.
- `next-intl` wired in `src/proxy.ts`; one string in an existing page renders through it.
- Playwright base config supports phase tags (`@phase-N` grep). `e2e/smoke.spec.ts` boots a distro and hits `/welcome`, `/tasklist`, `/admin`, `/cockpit`.
- README + run-distro README updated with Node prerequisite + minimum version pinned.
- Maven build integration decision documented (Maven-invokes-npm vs. pre-built tarball) + implemented.

**Exit criteria.**
1. Open questions Q1, Q2, Q3, Q4 answered or explicitly deferred to a specific later phase.
2. `mvn -pl webapps/webapp-rest -am clean install` succeeds; legacy webapp still serves `/camunda/app/*` with `--ui legacy` (no regression).
3. `--ui next` boots both Spring Boot and Next.js; `/camunda/app/welcome` reaches the Next.js page through the reverse proxy.
4. Reference plugin from `plugins-samples/` loads and renders into its slot.
5. `e2e/smoke.spec.ts` + `e2e/auth.spec.ts` pass against a clean distro.
6. All `/api/{cockpit,admin,tasklist,welcome}/*` rewrites resolve against the new `webapp-rest` module from a Next.js page.
7. Inventory rows above marked Phase 0 scope are ✅ or 🚫.

### Phase 1 — Welcome cutover

**Goal.** `/camunda/app/welcome` defaults to webapps-next.

**Deliverables.** Close all Phase 1 rows in §4.1: custom links, user profile widget, `welcome.profile` plugin slot host.

**Exit criteria** (per template + per-app):
1. Every §4.1 row is ✅ shipped or 🚫 dropped (with rationale).
2. All Phase 1 BE/DevOps handoffs resolved.
3. `npx playwright test --grep @phase-1` green against a fresh distro.
4. Manual smoke pass: load `/camunda/app/welcome` against `--ui next`, verify greeting, task counts, app cards, custom links (if any configured), user profile widget. Screenshots committed under `docs/superpowers/specs/evidence/phase-1/`.
5. Distro routing config updated: `--ui both` routes `/camunda/app/welcome/*` to Next; legacy welcome route disabled.
6. Legacy app continues to serve `/camunda/app/{tasklist,admin,cockpit}/*` unchanged.

### Phase 2 — Tasklist cutover

**Goal.** `/camunda/app/tasklist` defaults to webapps-next.

**Deliverables.** Close all Phase 2 rows in §4.2: task detail, claim/complete, form rendering, variables editor, identity links, comments, history, attachments, filters + filter editor, sort, three plugins (sorting, card, standaloneTask). Keyboard shortcuts and multi-engine selector either shipped or 🚫 with rationale.

**Exit criteria** (per template + per-app):
1. Every §4.2 row is ✅ or 🚫.
2. `npx playwright test --grep @phase-2` green.
3. Manual smoke pass: load `/camunda/app/tasklist`, claim a task, complete a task with a form, edit a variable, save a filter, switch to it. Evidence under `phase-2/`.
4. Distro routing: `/camunda/app/tasklist/*` → Next.
5. Phases 0+1 still pass.

### Phase 3 — Admin cutover

**Goal.** `/camunda/app/admin` defaults to webapps-next.

**Deliverables.** Close all Phase 3 rows in §4.3: user/group/authorization CRUD, tenant CRUD (gated on Q1), system info, system settings, diagnostics, execution metrics. Setup wizard and license-key UI per Q2/Q3 resolution. `admin-base` plugin ported.

**Exit criteria** (per template + per-app):
1. Every §4.3 row is ✅ or 🚫.
2. `npx playwright test --grep @phase-3` green.
3. Manual smoke pass: create user, edit user (password change, group membership), create group, create authorization, view execution metrics. Evidence under `phase-3/`.
4. Distro routing: `/camunda/app/admin/*` → Next.
5. Phases 0–2 still pass.

### Phase 4 — Cockpit cutover

**Goal.** `/camunda/app/cockpit` defaults to webapps-next. Biggest phase.

**Deliverables.** Close all Phase 4 rows in §4.4: every process/decision/batch/deployment page + every tab/action/diagram-overlay slot. Five Cockpit plugins ported (`cockpit-base`, `cockpit-decision-list`, `cockpit-external-tasks-tab`, `cockpit-job-definition`, `cockpit-tasks-dashboard`).

**Phase 4 will likely break into sub-plans** (per `gsd-plan-phase` style) along these lines:
- 4a — Process definition page (runtime + history views + all tabs + actions)
- 4b — Process instance page (runtime + history views + all tabs + actions + diagram overlays)
- 4c — Decision definition + decision instance (dmn-js wiring + tabs)
- 4d — Deployments + batches + tasks-dashboard + sidebar nav slot + global search

Each sub-plan ships independently but Phase 4 doesn't exit until all four are ✅.

**Exit criteria** (per template + per-app):
1. Every §4.4 row is ✅ or 🚫.
2. `npx playwright test --grep @phase-4` green — biggest suite by far.
3. Manual smoke pass: deploy a process, start an instance, view runtime + history tabs, retry an incident, cancel an instance, suspend a definition, edit a variable, view a decision evaluation, view batch detail. Evidence under `phase-4/`.
4. Distro routing: `/camunda/app/cockpit/*` → Next.
5. Phases 0–3 still pass.
6. **Default `--ui` flips from `legacy` to `next`** in `run.sh` + `run.bat`.

### Phase 5 — Legacy retirement

**Goal.** Delete `webapps/frontend/` and the asset-shell half of `webapps/assembly/`. Distro ships without AngularJS.

**No inventory of its own.** This phase is pure deletion + cleanup.

**Deliverables.**
- `webapps/frontend/` deleted from Maven reactor (`webapps/pom.xml` updated; root `pom.xml` parent reference removed).
- `webapps/assembly/` + `webapps/assembly-jakarta/` deleted; `webapp-rest` (from Phase 0) becomes the only assembly module.
- Distro launcher `--ui legacy` and `--ui both` modes deleted; `--ui next` becomes the only mode (flag itself can be removed).
- Release notes name the dropped artifacts (`camunda-webapp-*`, `camunda-webapp-jakarta`, AngularJS bundle).
- README updated: webapps-next is the only UI.

**Exit criteria.**
1. `git grep -l "angular\|webapps/frontend"` returns only docs/changelog references.
2. `./mvnw clean install` succeeds without `webapps/frontend/` or `webapps/assembly/`.
3. Distro `--ui` flag removed; `run.sh start --webapps` boots Next.js by default.
4. Playwright phases 1–4 still green.
5. Release notes drafted and reviewed.

---

## 8. Risks

| # | Risk | Mitigation | Owner phase |
|---|---|---|---|
| R1 | `webapps/assembly` hosts both REST API and static-asset shell | Split into `webapps/webapp-rest/` (stays) + asset shell (deleted Phase 5) | 0 |
| R2 | `AuthenticationFilter` belongs to assembly; survives the split? | Phase 0 ADR sub-decision; document filter behavior in the new `webapp-rest` module, and how it interacts with the next cookie session | 0 |
| R3 | Cockpit plugin slot catalog incomplete until grepped | Phase 0 deliverable produces full catalog (already drafted in §5.1 from the `ViewsProvider.registerDefaultView` scan); confirm + freeze | 0 |
| R4 | Distro launcher orchestrating two processes (Spring Boot + Next.js) is new | Phase 0 deliverable; smoke-tested on macOS + Linux + Windows before any cutover | 0 |
| R5 | Maven ↔ npm build integration: invoke npm from Maven vs. pre-built tarball | Phase 0 ADR: pick + implement one. Implication: Node version becomes a CI prereq if Maven invokes npm | 0 |
| R6 | Polling overhead at scale for Cockpit dashboards | Documented limit; TanStack Query dedup + tab-visibility-aware intervals; SSE is a post-cutover candidate, not a phase gate | (acknowledged) |
| R7 | `--ui both` routing during cutover windows: legacy and next sessions don't share cookies | Document the constraint; users may need to log in twice during the cutover window; mitigated by short windows | 1–4 |
| R8 | Manual screenshot evidence is operator-dependent; no visual regression tool | Each phase's evidence dir committed to git; PR review compares against prior phase's set | 1–5 |

---

## 9. Out of scope

The roadmap does NOT cover:

- Adding new features beyond legacy parity.
- Engine REST API changes (any new endpoint or shape change is a BE-side change with user approval per CLAUDE.md).
- Performance work (perf parity is not a phase gate; documented as R6).
- Accessibility audit (not a phase gate; tracked separately if/when raised).
- Design polish beyond shadcn defaults (not a phase gate).
- Embedded/Jakarta-EE distros other than Camunda Run (other distros adopt the new UI in a follow-up roadmap).
- Internationalization beyond `en` + `de` (matches legacy scope).
- New diagram libraries beyond bpmn-js/dmn-js/cmmn-js/form-js (already deps).

---

## 10. Glossary

- **Slot** — a named React component in webapps-next that hosts plugin-supplied children, keyed by id (e.g. `cockpit.processInstance.runtime.tab`). Legacy term: "view" registered via `ViewsProvider.registerDefaultView(id, def)`.
- **Plugin** — a directory under `webapps-next/plugins/<id>/` containing a `plugin.json` and at least a client entry. Plugins register components into slots.
- **Cutover window** — the period during a phase when `--ui both` is active and one app's route is being flipped from legacy to next. Aim for short windows (a single deploy).
- **Per-app cutover** — Welcome / Tasklist / Admin / Cockpit each flip independently. Distro routing config gates the flip.
- **engine-rest** — the existing Java REST module in `engine-rest/`. Source of truth for engine state. Out-of-scope for changes.
- **webapp-rest** — proposed new Maven module (Phase 0) holding the non-engine-rest Spring endpoints that today live in `webapps/assembly/`.
