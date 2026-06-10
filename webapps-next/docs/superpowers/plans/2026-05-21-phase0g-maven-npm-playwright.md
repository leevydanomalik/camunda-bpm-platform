# Phase 0g — Maven↔npm integration ADR + Playwright phase-tag harness — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **DevOps-led** — most tasks touch build wiring + docs. No BE-source or FE-source feature changes.

**Goal:** Close the two remaining Phase 0 deliverables not handled elsewhere: (1) commit the architectural decision that Maven invokes npm at build time (vs. a pre-built tarball workflow), and (2) add a Playwright phase-tag harness so `npm run test:e2e:phase-0` runs only `@phase-0`-tagged specs. Also adds the `e2e/smoke.spec.ts` that Phase 0 exit criteria require (hits `/welcome`, `/tasklist`, `/admin`, `/cockpit` with an authenticated session).

**Architecture:** A short ADR file (`docs/architecture/ADR-001-maven-invokes-npm.md`) captures the decision + rationale. `package.json` gains `test:e2e:phase-N` scripts (one per phase 0–5) that delegate to `playwright test --grep @phase-N`. A new `e2e/smoke.spec.ts` covers the four app paths. Node 20+ prereq gets prominent mention in the root README so the Maven-invokes-npm contract is operator-visible.

**Tech Stack:** Markdown ADR, npm scripts, Playwright. No new deps. No source-code feature changes.

**Source spec:** `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` — §7 Phase 0 deliverables (last two bullets) + R5 risk.

---

## File structure

**Created:**

- `docs/architecture/ADR-001-maven-invokes-npm.md` — the one-page ADR.
- `webapps-next/e2e/smoke.spec.ts` — boot-the-distro smoke for all four apps.

**Modified:**

- `webapps-next/package.json` — add `test:e2e:phase-N` scripts (N=0..5).
- `webapps-next/playwright.config.js` — annotate that phase scoping is by `--grep @phase-N` (no config change; comment-only).
- `README.md` (root, of `camunda-bpm-platform`) — add Node prereq + brief Maven-invokes-npm note.
- `webapps-next/README.md` — cross-link to the ADR.

---

## Task ordering & dependencies

```
Task 1 (ADR write + commit) — standalone
Task 2 (root README Node prereq) — depends on Task 1 (cross-links)
Task 3 (package.json test:e2e:phase-N scripts) — standalone
Task 4 (e2e/smoke.spec.ts) — depends on Phase 0c+e (login fixture exists)
Task 5 (webapps-next README cross-link) — depends on Task 1
Task 6 (full-suite check) — depends on all
```

Tasks 1, 3 are parallelizable. Tasks 2, 5 depend on Task 1. Task 4 depends on Phase 0c+e having shipped (which provides `loginAs` fixture).

---

### Task 1: Write the Maven↔npm ADR

**Files:**
- Create: `docs/architecture/ADR-001-maven-invokes-npm.md`

- [ ] **Step 1: Create the ADR directory if needed**

Run: `mkdir -p /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/docs/architecture`

- [ ] **Step 2: Create the ADR file**

```markdown
# ADR-001 — Maven invokes npm for webapps-next build

**Date:** 2026-05-21
**Status:** Accepted
**Context:** Phase 0 of the webapps-next migration (see `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` §3.4 + R5).

## Decision

The Camunda Run distro Maven build invokes `npm ci && npm run build` (via `exec-maven-plugin`) in `webapps-next/` and bundles the resulting `.next/standalone/` output into the distro tarball. The build system **does not** rely on a pre-built artifact committed to the repo, nor on a separate CI pipeline producing the tarball as a build input.

## Alternatives considered

**A. Pre-built tarball checked into the repo.** Maven downloads / unpacks a tarball produced by a separate CI step. Avoids the Node prerequisite on the Maven side; works in any Java-only environment.
- **Rejected because:** Updates to the FE require an out-of-band CI run before the Maven build sees them. Developer feedback loop is brittle. Tarballs in git are large (~50MB compressed); they bloat history.

**B. Separate Docker image for webapps-next.** Java distro stays Node-free; the UI ships as its own container.
- **Rejected because:** Bifurcates the user base. Bare-metal distro operators (the historical Camunda Run audience) would stay on legacy webapps forever. Conflicts with §3.4 (standalone Node inside distro).

**C. Pre-built tarball in CI, downloaded from a Maven repository.** Best of A + automation; the FE artifact lives in `repository.camunda.com` as a Maven coord.
- **Rejected for v1 because:** Requires CI + repository plumbing not yet in place. Worth revisiting post-cutover if Maven build times become painful.

## Consequences

**Required prerequisites for any full distro build:**
- Node.js 20+ on `PATH` (matches the `WEBAPPS_NEXT_PORT` runtime check in `run.sh`).
- `npm` (ships with Node).

**Documented in:**
- Root `README.md` (this commit).
- `webapps-next/README.md`.
- `distro/run/README.md` (Phase 0d plan).

**Build time impact:**
- `./mvnw clean install` (full reactor) gains ~1 minute the first time (`npm ci` populates `node_modules`); subsequent builds ~10s for `next build`.
- Scoped builds that skip `distro/run/modules/webapps-next` are unaffected.

**CI impact:**
- CI runners that build the distro need Node 20+. The existing build profile (`./mvnw -pl distro/run -am clean install`) requires the new prereq; partial builds (e.g. engine-only `./mvnw -pl engine -am`) do not.

## Re-evaluate when

- The webapps-next module ships in production for ≥1 release without build-time issues, AND
- Build times become a measurable pain point (≥3 minutes added to typical CI).

Then revisit option C.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add docs/architecture/ADR-001-maven-invokes-npm.md
git -c commit.gpgsign=false commit -m "docs(adr): ADR-001 Maven invokes npm for webapps-next build

Resolves spec R5. Captures rejected alternatives (pre-built tarball,
separate Docker image, repo-published artifact). Lists the
prerequisites it implies (Node 20+ on PATH) and the build-time impact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Root README — Node prereq + ADR cross-link

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Locate the right section in the root README**

Run: `head -60 /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform/README.md`

Find the "Prerequisites" / "Requirements" section if it exists. If not, find where the first "## " heading lives.

- [ ] **Step 2: Add a Node prereq line**

Edit the prerequisites section to include:

```markdown
- **Node.js 20+** (only required if you build the `distro/run/modules/webapps-next` module, which is part of the default `./mvnw clean install`).
  - See [ADR-001](docs/architecture/ADR-001-maven-invokes-npm.md) for rationale.
```

If no prereq section exists, add one after the project intro and before the "Building" / "Getting started" heading.

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add README.md
git -c commit.gpgsign=false commit -m "docs(readme): Node 20+ prereq for full distro builds

Links to ADR-001. Builds that scope to engine-only (./mvnw -pl engine
-am …) don't need Node — only full reactor or distro builds do.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: package.json — phase-tag npm scripts

**Files:**
- Modify: `webapps-next/package.json`

- [ ] **Step 1: Add scripts**

In `webapps-next/package.json`, replace the existing `"test:e2e": "playwright test"` line with:

```json
    "test:e2e": "playwright test",
    "test:e2e:phase-0": "playwright test --grep @phase-0",
    "test:e2e:phase-1": "playwright test --grep @phase-1",
    "test:e2e:phase-2": "playwright test --grep @phase-2",
    "test:e2e:phase-3": "playwright test --grep @phase-3",
    "test:e2e:phase-4": "playwright test --grep @phase-4",
    "test:e2e:phase-5": "playwright test --grep @phase-5",
```

- [ ] **Step 2: Confirm playwright.config.js needs no change**

The existing `playwright.config.js` (read earlier in this session) doesn't restrict by tag; `--grep` filters at runtime by matching test/describe titles. The `@phase-N` convention from existing specs (`auth.spec.ts`, `multi-engine.spec.ts`, etc. — all created in Phase 0c+e) is the pattern.

Add a comment near the top of `playwright.config.js`:

```js
/**
 * Phase scoping: tests tagged with `@phase-N` in their describe titles can
 * be filtered via `npm run test:e2e:phase-N` (delegates to
 * `playwright test --grep @phase-N`). See spec §7 for the phase model.
 */
```

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add package.json playwright.config.js
git -c commit.gpgsign=false commit -m "build(npm): test:e2e:phase-N scripts (0..5)

Wraps playwright test --grep @phase-N. Phase model from spec §7;
existing specs already tag describes with @phase-0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: e2e/smoke.spec.ts — phase 0 smoke

**Files:**
- Create: `webapps-next/e2e/smoke.spec.ts`

**Depends on:** Phase 0c+e shipped (provides `loginAs` fixture in `e2e/_fixtures.ts`). If executing this plan ahead of Phase 0c+e, write a self-contained fixture inline.

- [ ] **Step 1: Create the smoke spec**

```ts
import { expect } from "@playwright/test";

import { loginAs, test } from "./_fixtures";

test.describe("smoke @phase-0", () => {
  test("authenticated user can load all four app shells", async ({ page, request }) => {
    await loginAs(request);
    await page.context().addCookies(
      (await request.storageState()).cookies.map((c) => ({
        ...c,
        url: "http://localhost:3000",
      })),
    );

    for (const path of ["/welcome", "/tasklist", "/admin", "/cockpit"]) {
      const response = await page.goto(path);
      expect(response, `navigating to ${path}`).not.toBeNull();
      expect(response!.status(), `${path} HTTP status`).toBeLessThan(500);
      // Sidebar should be present on every authed page.
      await expect(page.locator("[data-slot=sidebar]"), `sidebar on ${path}`).toBeVisible();
    }
  });

  test("unauthenticated request is redirected to /login", async ({ page }) => {
    const response = await page.goto("/cockpit");
    expect(response!.status()).toBeLessThan(400);
    expect(page.url()).toMatch(/\/login(\?|$)/);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd webapps-next && npm run test:e2e:phase-0`

Expected: this spec passes alongside the other `@phase-0` specs from earlier plans (auth, multi-engine, plugins, i18n).

If `[data-slot=sidebar]` doesn't match (the shadcn sidebar may use a different attribute), adjust the locator to whatever the actual sidebar root carries. Inspect with browser devtools to find the right selector.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add e2e/smoke.spec.ts
git -c commit.gpgsign=false commit -m "test(e2e): @phase-0 smoke — all four apps load + auth redirect

Spec §7 Phase 0 exit criteria: e2e/smoke.spec.ts boots a distro and
hits /welcome /tasklist /admin /cockpit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: webapps-next README cross-link to ADR

**Files:**
- Modify: `webapps-next/README.md`

- [ ] **Step 1: Append a Build section**

Find the existing "Getting started" / "Running" section, or append at the end:

```markdown
## Build wiring

The Camunda Run distro Maven build invokes `npm ci && npm run build` in this directory and bundles the standalone output. See [ADR-001](../docs/architecture/ADR-001-maven-invokes-npm.md) for the decision and tradeoffs. Local dev still uses `npm run dev` directly; the Maven path is only for distro packaging.

## Phase-scoped e2e

The spec (`docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md`) divides the migration into six numbered phases. Each phase's Playwright specs are tagged `@phase-N` in their describe titles. Run scoped subsets:

```bash
npm run test:e2e:phase-0   # Foundation specs only
npm run test:e2e:phase-1   # Welcome cutover specs
# ...
npm run test:e2e           # everything
```
```

- [ ] **Step 2: Commit**

```bash
cd webapps-next
git add README.md
git -c commit.gpgsign=false commit -m "docs(readme): ADR-001 cross-link + phase-scoped e2e

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full-suite check + tag

- [ ] **Step 1: Run phase 0 e2e**

```bash
cd webapps-next
npm run test:e2e:phase-0
```

Expected: every spec tagged `@phase-0` runs and passes (auth.spec.ts, multi-engine.spec.ts, plugins.spec.ts, i18n.spec.ts, smoke.spec.ts).

- [ ] **Step 2: Run an empty-phase scope to confirm filtering works**

```bash
cd webapps-next
npm run test:e2e:phase-5
```

Expected: "no tests found matching @phase-5". That's the right behavior — phase 5 specs don't exist yet.

- [ ] **Step 3: Tag**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git tag webapps-next/phase-0g-done
```

No commit needed.

---

## Self-review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §7 Phase 0 deliverable: Maven build integration decision documented + implemented | Task 1 (ADR), Task 2 (README), plus the wiring sits in Phase 0d Tasks 2–3 |
| §7 Phase 0 deliverable: Playwright base config supports phase tags (`@phase-N` grep) | Task 3 |
| §7 Phase 0 deliverable: e2e/smoke.spec.ts boots a distro and hits /welcome, /tasklist, /admin, /cockpit | Task 4 |
| §7 Phase 0 deliverable: Node prerequisite pinned and documented | Task 1 (ADR), Task 2 (root README) |
| R5 (Maven↔npm) | Task 1 |

**Placeholder scan:** clean. Every code/text block is full.

**Type consistency:** N/A (no new types).

**Note on partial coverage:** The "implementation" half of the Maven↔npm decision lives in Phase 0d's Tasks 2–3 (the `distro/run/modules/webapps-next/pom.xml` and assembly wiring). This plan handles the decision-record + documentation half. The two plans together close §7's deliverable.

---

## Execution handoff

Plan complete and saved to `webapps-next/docs/superpowers/plans/2026-05-21-phase0g-maven-npm-playwright.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — small plan; can be done in a single dispatch with the full task list inline.

**2. Inline Execution** — fastest given the small size.

Which approach?
