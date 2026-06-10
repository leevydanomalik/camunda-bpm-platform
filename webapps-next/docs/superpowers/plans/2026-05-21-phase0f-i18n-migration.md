# Phase 0f — i18n migration + next-intl wiring — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate legacy AngularJS locale files (`webapps/frontend/public/app/{cockpit,tasklist,admin,welcome}/locales/{en,de}.json`) into `next-intl`'s flat-key namespace structure at `webapps-next/messages/{en,de}.json`, then wire `next-intl` end-to-end so pages can render translated strings. Includes a one-shot migration script that handles the AngularJS nested-key → next-intl flat-key conversion and a key-collision report.

**Architecture:** A standalone Node ESM script (`scripts/migrate-locales.mjs`) reads the four legacy locale files per language, flattens their AngularJS-style nested paths (`labels.ABORT` → `legacy.cockpit.labels.ABORT`) into namespaced keys, merges, detects collisions (same flat key, different value across apps), and writes `messages/<lang>.json`. The next-intl middleware integrates with the existing `src/proxy.ts` to detect locale from cookie / Accept-Language. A new `src/i18n.ts` config module declares supported locales. The existing Welcome page is converted to use `useTranslations` as a proof-of-flow. Locale switching happens via a server-side `/api/auth/locale` route (stub for Phase 3 Admin UI; Phase 0 ships cookie-only switching via curl/devtools).

**Tech Stack:** Next.js 16 App Router, `next-intl` 3.x (already a dep), Node 20+ ESM modules. No new runtime deps.

**Source spec:** `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` — §3.6 i18n decision, §7 Phase 0 deliverables.

---

## File structure

**Created:**

- `webapps-next/scripts/migrate-locales.mjs` — one-shot migration script. Run via `node --experimental-strip-types` (or plain Node ESM).
- `webapps-next/messages/en.json` — merged output of the migration.
- `webapps-next/messages/de.json` — same, German.
- `webapps-next/messages/INGEST-CONFLICTS.md` — collision report (committed alongside merge output; cleaned up post-merge).
- `webapps-next/src/i18n.ts` — next-intl config (supported locales, default locale, time zone).
- `webapps-next/src/i18n/request.ts` — `getRequestConfig` implementation for App Router.
- `webapps-next/src/app/api/auth/locale/route.ts` — POST { locale: "en" | "de" } → sets `NEXT_LOCALE` cookie.
- `webapps-next/e2e/i18n.spec.ts` — verifies a translated string renders, then switching locale changes it.

**Modified:**

- `webapps-next/next.config.mjs` — wrap export with `createNextIntlPlugin()`.
- `webapps-next/src/proxy.ts` — chain next-intl middleware after the existing auth/CSRF middleware so locale resolves on every request.
- `webapps-next/src/app/(app)/welcome/page.tsx` — replace one hardcoded string with `useTranslations()` to prove the flow end-to-end.
- `webapps-next/README.md` — add an "i18n" section.

---

## Task ordering & dependencies

```
Task 1 (migration script) — standalone, run once
  └─ Task 2 (run + commit messages/{en,de}.json + collision report)
       └─ Task 3 (src/i18n.ts + src/i18n/request.ts)
            └─ Task 4 (next.config.mjs createNextIntlPlugin)
                 └─ Task 5 (proxy.ts chain locale middleware)
                      └─ Task 6 (/api/auth/locale route)
                           └─ Task 7 (welcome page uses useTranslations)
                                └─ Task 8 (e2e/i18n.spec.ts)
                                     └─ Task 9 (README + full-suite check)
```

Strictly sequential — every task depends on at least one before it.

---

### Task 1: Migration script

**Files:**
- Create: `webapps-next/scripts/migrate-locales.mjs`

- [ ] **Step 1: Create the script**

```js
#!/usr/bin/env node
// Migrates legacy AngularJS locale files into next-intl flat-key namespaces.
//
// Input:
//   webapps/frontend/public/app/{cockpit,tasklist,admin,welcome}/locales/{en,de}.json
// Output:
//   webapps-next/messages/{en,de}.json
//   webapps-next/messages/INGEST-CONFLICTS.md
//
// Key convention: AngularJS `labels.ABORT` from cockpit → `legacy.cockpit.labels.ABORT`
// (next-intl reads nested objects as namespaces, so the legacy paths flatten
// nicely into a `legacy.<app>` umbrella that's clearly separated from new strings).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const LEGACY = join(ROOT, "../webapps/frontend/public/app");
const OUT = join(ROOT, "messages");
const CONFLICT_REPORT = join(OUT, "INGEST-CONFLICTS.md");

const APPS = ["cockpit", "tasklist", "admin", "welcome"];
const LANGS = ["en", "de"];

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readLocale(app, lang) {
  const path = join(LEGACY, app, "locales", `${lang}.json`);
  try {
    return JSON.parse(stripBom(readFileSync(path, "utf8")));
  } catch (e) {
    console.warn(`[migrate-locales] ${path} unreadable — skipping (${e.message})`);
    return {};
  }
}

// flatten({a:{b:"x"}}, "p") -> {"p.a.b":"x"}
function flatten(obj, prefix) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}.${k}`;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

// {"a.b.c": "v"} -> {a: {b: {c: "v"}}}
function unflatten(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}

function migrate(lang) {
  const merged = {};
  const collisions = [];
  for (const app of APPS) {
    const raw = readLocale(app, lang);
    const flat = flatten(raw, `legacy.${app}`);
    for (const [k, v] of Object.entries(flat)) {
      if (k in merged && merged[k] !== v) {
        collisions.push({ key: k, existing: merged[k], incoming: v, app });
        // Keep the first-seen value; collisions are surfaced in the report.
      } else {
        merged[k] = v;
      }
    }
  }
  return { merged, collisions };
}

function writeReport(allCollisions) {
  const lines = [
    "# Locale ingest conflicts",
    "",
    "Same flat key, different value, across multiple legacy app locale files.",
    "Resolution: the migration kept the first-seen value (app order: cockpit → tasklist → admin → welcome).",
    "Review and override in `messages/<lang>.json` if needed.",
    "",
  ];
  if (allCollisions.length === 0) {
    lines.push("**No collisions.** All keys resolved cleanly.");
    writeFileSync(CONFLICT_REPORT, lines.join("\n"));
    return;
  }
  lines.push("| Lang | Key | Kept value | Rejected value | From app |");
  lines.push("|---|---|---|---|---|");
  for (const c of allCollisions) {
    lines.push(`| ${c.lang} | \`${c.key}\` | \`${JSON.stringify(c.existing)}\` | \`${JSON.stringify(c.incoming)}\` | ${c.app} |`);
  }
  writeFileSync(CONFLICT_REPORT, lines.join("\n"));
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const allCollisions = [];
  for (const lang of LANGS) {
    const { merged, collisions } = migrate(lang);
    const nested = unflatten(merged);
    writeFileSync(join(OUT, `${lang}.json`), JSON.stringify(nested, null, 2) + "\n");
    for (const c of collisions) allCollisions.push({ lang, ...c });
    console.log(`[migrate-locales] wrote messages/${lang}.json (${Object.keys(merged).length} keys, ${collisions.length} collisions)`);
  }
  writeReport(allCollisions);
}

main();
```

- [ ] **Step 2: Commit the script**

```bash
cd webapps-next
git add scripts/migrate-locales.mjs
git -c commit.gpgsign=false commit -m "feat(i18n): one-shot legacy locale migration script

Reads webapps/frontend/public/app/{cockpit,tasklist,admin,welcome}/
locales/{en,de}.json. Flattens AngularJS-style nested paths into a
legacy.<app> namespace, merges, detects collisions, writes
messages/{en,de}.json + messages/INGEST-CONFLICTS.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Run migration; commit messages + collision report

**Files:**
- Created by script: `webapps-next/messages/en.json`, `webapps-next/messages/de.json`, `webapps-next/messages/INGEST-CONFLICTS.md`

- [ ] **Step 1: Run the script**

Run: `cd webapps-next && node scripts/migrate-locales.mjs`

Expected output:
```
[migrate-locales] wrote messages/en.json (N keys, M collisions)
[migrate-locales] wrote messages/de.json (N keys, M collisions)
```

Where N is the merged key count (likely 1500-2000 across four apps × labels) and M is the collision count.

- [ ] **Step 2: Inspect the conflict report**

Run: `cat webapps-next/messages/INGEST-CONFLICTS.md`

If collisions exist, review them. Common case: shared keys like `legacy.cockpit.labels.ABORT` and `legacy.admin.labels.ABORT` may have identical values (no collision recorded — only differing values are flagged). Differing values across apps may need manual reconciliation; for v0, the first-seen value (cockpit) wins.

- [ ] **Step 3: Commit the messages + report**

```bash
cd webapps-next
git add messages/
git -c commit.gpgsign=false commit -m "feat(i18n): migrated en + de locales from legacy AngularJS

Flat-key namespace: legacy.<app>.<original-nested-path>. Collisions
(same key, different value) recorded in messages/INGEST-CONFLICTS.md.
First-seen value (cockpit-first order) wins.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: next-intl config modules

**Files:**
- Create: `webapps-next/src/i18n.ts`
- Create: `webapps-next/src/i18n/request.ts`

- [ ] **Step 1: Create `src/i18n.ts`**

```ts
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Create `src/i18n/request.ts`** (next-intl App Router convention)

```ts
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale, isLocale } from "@/i18n";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return loadLocale(cookieLocale);
  }

  // Fall back to Accept-Language; first matching supported locale wins.
  const accept = (await headers()).get("accept-language") ?? "";
  for (const tag of accept.split(",").map((t) => t.trim().split(";")[0])) {
    const short = tag.split("-")[0];
    if (isLocale(short)) return loadLocale(short);
  }

  return loadLocale(DEFAULT_LOCALE);
});

async function loadLocale(locale: Locale) {
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
}
```

- [ ] **Step 3: Run TS check**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors. (`next-intl/server` already in deps.)

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/i18n.ts src/i18n/request.ts
git -c commit.gpgsign=false commit -m "feat(i18n): next-intl config + request resolver

LOCALES = [en, de]. Resolution order: cookie → Accept-Language → en.
src/i18n/request.ts implements next-intl's getRequestConfig contract
for App Router.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire next-intl into `next.config.mjs`

**Files:**
- Modify: `webapps-next/next.config.mjs`

- [ ] **Step 1: Wrap the config with `createNextIntlPlugin`**

At the top of `webapps-next/next.config.mjs`:

```js
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
```

At the bottom, change `export default nextConfig;` to:

```js
export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Smoke check**

Run: `cd webapps-next && npm run build`

Expected: build succeeds; no next-intl plugin errors. If "Cannot find module './src/i18n/request.ts'", confirm Task 3 file was created.

Stop any running dev server before this.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add next.config.mjs
git -c commit.gpgsign=false commit -m "feat(i18n): wire createNextIntlPlugin

Points at src/i18n/request.ts as the request config resolver. Plugin
wires the i18n context into every RSC + client render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Locale resolution doesn't need middleware

`next-intl` for App Router resolves locale via `getRequestConfig` (per Task 3) — no middleware needed for non-prefixed locales. The existing `src/proxy.ts` middleware doesn't need changes for i18n. **This task is intentionally a no-op** to make the dependency order explicit.

- [ ] **Step 1: Confirm `proxy.ts` doesn't need a change**

Re-read `webapps-next/src/proxy.ts`. The `getRequestConfig` flow handles locale entirely through cookies + Accept-Language on the server. The middleware doesn't touch i18n.

- [ ] **Step 2: Skip to Task 6** — no commit.

---

### Task 6: `/api/auth/locale` POST endpoint

**Files:**
- Create: `webapps-next/src/app/api/auth/locale/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";

import { LOCALE_COOKIE, isLocale } from "@/i18n";

export async function POST(req: Request) {
  let body: { locale?: string };
  try {
    body = (await req.json()) as { locale?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = body.locale;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
```

- [ ] **Step 2: Add `/api/auth/locale` to the CSRF-public list in `src/proxy.ts`**

Open `webapps-next/src/proxy.ts`. In the `PUBLIC_PATH_PREFIXES` array, add:

```ts
  "/api/auth/locale",
```

Wait — locale switching is a mutation (it changes a cookie). Should it require CSRF? Yes for safety. But it's also called from places that may not have a session yet (login page locale toggle). Compromise: keep it CSRF-protected, but the login page client doesn't need a session — only a CSRF cookie. Since CSRF is established at login, the login page itself can't toggle locale without a session. Pre-login locale comes from Accept-Language.

So: **don't** add to PUBLIC_PATH_PREFIXES. Locale switch is only available post-login. Pre-login users see their browser's preferred language.

Reverse the change above. Move on.

- [ ] **Step 3: Smoke check**

Run dev server: `npm run dev`. Login, then:

```bash
# Login first (from another terminal):
curl -i -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

CSRF=$(grep camunda-next.csrf /tmp/c.txt | awk '{print $7}')

# Switch to German:
curl -i -b /tmp/c.txt -H "X-Csrf-Token: $CSRF" \
  -X POST http://localhost:3000/api/auth/locale \
  -H 'content-type: application/json' \
  -d '{"locale":"de"}'
# Expect: 200 + Set-Cookie: NEXT_LOCALE=de

# Unsupported locale:
curl -i -b /tmp/c.txt -H "X-Csrf-Token: $CSRF" \
  -X POST http://localhost:3000/api/auth/locale \
  -H 'content-type: application/json' \
  -d '{"locale":"fr"}'
# Expect: 400 {"error":"Unsupported locale"}
```

Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/app/api/auth/locale/route.ts
git -c commit.gpgsign=false commit -m "feat(i18n): POST /api/auth/locale switches NEXT_LOCALE cookie

Requires CSRF (mutation), so authenticated users only. Pre-login users
get locale from Accept-Language via i18n/request.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Convert welcome page to use `useTranslations`

**Files:**
- Modify: `webapps-next/src/app/(app)/welcome/page.tsx`

- [ ] **Step 1: Add a fresh-string translation entry** so the welcome page can verify the i18n pipeline beyond legacy migration

Open `webapps-next/messages/en.json`. Add (at the root, alongside the `legacy` object):

```json
  "welcome": {
    "subtitle": "Camunda Platform"
  }
```

Open `webapps-next/messages/de.json`. Add at root:

```json
  "welcome": {
    "subtitle": "Camunda Plattform"
  }
```

(Both files need a trailing comma in the right place — preserve valid JSON.)

- [ ] **Step 2: Convert the welcome page subtitle to translated**

Read the existing welcome page first:

```bash
cat 'webapps-next/src/app/(app)/welcome/page.tsx' | head -30
```

Locate the existing "Camunda Platform" subtitle. Replace its rendering with a `useTranslations("welcome")` call. Since the page is a server component, use `getTranslations` from `next-intl/server`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function WelcomePage() {
  const session = await getSession();
  const t = await getTranslations("welcome");

  // … existing logic …

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {session?.username ?? "guest"}
        </h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      {/* … rest unchanged … */}
    </div>
  );
}
```

Adapt to the existing welcome page shape. The point is: one hardcoded string is now translated via `t("subtitle")`.

- [ ] **Step 3: Smoke check**

Run dev server. Visit `/welcome`. Expect: "Camunda Platform" subtitle. Then in devtools:

```js
document.cookie = "NEXT_LOCALE=de; path=/";
location.reload();
```

Expect: subtitle is now "Camunda Plattform".

Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add 'src/app/(app)/welcome/page.tsx' messages/en.json messages/de.json
git -c commit.gpgsign=false commit -m "feat(i18n): welcome page uses next-intl

Proof-of-flow: one string ('Welcome's subtitle) is rendered through
getTranslations("welcome"). messages/{en,de}.json gain a welcome.*
namespace for fresh (non-legacy) strings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: E2E spec

**Files:**
- Create: `webapps-next/e2e/i18n.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { expect } from "@playwright/test";

import { loginAs, test } from "./_fixtures";

test.describe("i18n @phase-0", () => {
  test("default locale renders English welcome subtitle", async ({ page, request }) => {
    await loginAs(request);
    await page.context().addCookies(
      (await request.storageState()).cookies.map((c) => ({
        ...c,
        url: "http://localhost:3000",
      })),
    );
    await page.goto("/welcome");
    await expect(page.getByText(/Camunda Platform$/)).toBeVisible();
  });

  test("setting NEXT_LOCALE=de renders German welcome subtitle", async ({ page, request }) => {
    await loginAs(request);
    await page.context().addCookies([
      ...(await request.storageState()).cookies.map((c) => ({
        ...c,
        url: "http://localhost:3000",
      })),
      { name: "NEXT_LOCALE", value: "de", url: "http://localhost:3000", path: "/" },
    ]);
    await page.goto("/welcome");
    await expect(page.getByText(/Camunda Plattform$/)).toBeVisible();
  });

  test("POST /api/auth/locale with unsupported locale returns 400", async ({ request }) => {
    const { csrf } = await loginAs(request);
    const res = await request.post("/api/auth/locale", {
      headers: { "X-Csrf-Token": csrf, "content-type": "application/json" },
      data: { locale: "fr" },
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd webapps-next && npx playwright test e2e/i18n.spec.ts --grep @phase-0`

Expected: 3 tests pass. Requires a running engine for `loginAs` to succeed.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add e2e/i18n.spec.ts
git -c commit.gpgsign=false commit -m "test(e2e): i18n — default locale, locale switch via cookie, validation

@phase-0 tagged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: README + full-suite check

**Files:**
- Modify: `webapps-next/README.md`

- [ ] **Step 1: Append i18n section to README**

```markdown
## i18n

`next-intl` provides translations. Source files: `messages/en.json` (English), `messages/de.json` (German).

**Adding strings.** Drop a key into both files at the same path:

```json
{
  "myFeature": { "title": "Hello" }
}
```

In a server component: `const t = await getTranslations("myFeature"); ... {t("title")}`.
In a client component: `const t = useTranslations("myFeature"); ... {t("title")}`.

**Legacy strings.** The `legacy.<app>.<path>` namespace holds 1500+ strings migrated from the AngularJS UI by `scripts/migrate-locales.mjs`. Use these when porting legacy pages so translated values carry over.

**Switching locale.** `POST /api/auth/locale { locale: "de" }` (requires CSRF). Pre-login users get locale from `Accept-Language` (English fallback).

**Re-running the migration.** Only needed if legacy locale files change (they shouldn't — they're frozen for this rewrite). Run `node scripts/migrate-locales.mjs`. Diff `messages/INGEST-CONFLICTS.md` for unresolved keys.
```

- [ ] **Step 2: Full-suite check**

```bash
cd webapps-next
npm run check
npx tsc --noEmit
npm run build
npx playwright test --grep @phase-0
```

Expected: all green.

- [ ] **Step 3: Tag**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git tag webapps-next/phase-0f-done
```

- [ ] **Step 4: Commit README**

```bash
cd webapps-next
git add README.md
git -c commit.gpgsign=false commit -m "docs(i18n): authoring + migration notes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §3.6 next-intl as the i18n library | Tasks 3, 4 |
| §3.6 messages/{en,de}.json source files | Task 2 |
| §3.6 one-shot migration script | Tasks 1, 2 |
| §3.6 collision log committed | Task 2 (INGEST-CONFLICTS.md) |
| §3.6 next-intl wired with proxy.ts | Task 5 (no-op; resolution via getRequestConfig handles it) |
| §3.6 one string rendered through next-intl | Task 7 |
| §7 Phase 0 deliverable: i18n scaffolding wired | Tasks 3–7 |
| §7 Phase 0 exit: one string rendered through next-intl from locales/en.json | Task 7 + Task 8 test 1 |

**Placeholder scan:** clean. The migration script is full source. JSON edits in Task 7 reference specific paths.

**Type consistency:**
- `Locale` union (`"en" | "de"`) used in: `src/i18n.ts` (Task 3), `src/i18n/request.ts` (Task 3), `src/app/api/auth/locale/route.ts` (Task 6). ✓
- `LOCALE_COOKIE` constant referenced from `src/i18n.ts` and `route.ts`. ✓
- Migration script's flat-key format `legacy.<app>.<path>` matches the lookup pattern in welcome page (Task 7 uses fresh `welcome.subtitle` namespace; legacy pages port by reading `legacy.<app>.labels.X`).

---

## Execution handoff

Plan complete and saved to `webapps-next/docs/superpowers/plans/2026-05-21-phase0f-i18n-migration.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Camunda FE-persona subagent per task; collision report in Task 2 may warrant human review.

**2. Inline Execution** — execute in this session via executing-plans.

Which approach?
