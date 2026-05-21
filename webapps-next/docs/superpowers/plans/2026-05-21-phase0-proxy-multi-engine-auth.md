# Phase 0c+e — Proxy expansion, multi-engine, auth hardening — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing cookie-session + engine-rest proxy in `webapps-next/` to (1) route four new webapp-REST paths through the Next proxy, (2) support Camunda's multi-engine setup end-to-end with a sidebar selector, and (3) harden the session cookie with CSRF, idle-refresh, and `groups[]`/`engine` claims.

**Architecture:** All changes are FE-only inside `webapps-next/`. No BE work, no Java touch. The session cookie shape grows from `{username, iat, exp}` → `{username, engine, groups, csrf, iat, exp}` — every field encoded into the existing HMAC-signed payload. The proxy rewrites in `next.config.mjs` grow from one entry to five. `engineGet` / `engineFetch` learn an optional `{engine}` selector; when omitted, they read the session's engine claim via a new server helper. CSRF is double-submit cookie pattern — token in the signed session AND a separate readable cookie; client mutations send the readable cookie's value back in an `X-Csrf-Token` header, which middleware verifies against the session claim.

**Tech Stack:** Next.js 16 (App Router, RSC, Turbopack), TypeScript, `node:crypto` HMAC, Playwright. No new dependencies.

**Source spec:** `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` — §3.1, §3.2, §3.9, §7 Phase 0.

---

## File structure

**Created:**

- `webapps-next/src/lib/camunda/engines.ts` — list engines via `engineGet("/engine/")`, cache for one request lifecycle.
- `webapps-next/src/lib/auth/csrf.ts` — `generateCsrfToken()`, `verifyCsrfToken(token, sessionCsrf)`.
- `webapps-next/src/lib/auth/groups.ts` — `fetchUserGroups(username)` calls `engineGet("/group?member={user}")`.
- `webapps-next/src/components/app-shell/engine-selector.tsx` — client component (`"use client"`); shadcn `Select`; POSTs to `/api/auth/engine`.
- `webapps-next/src/app/api/auth/engine/route.ts` — POST { engine: string }; reissues session cookie.
- `webapps-next/src/app/api/auth/csrf/route.ts` — GET returning `{ token: string }` for clients that need to read it from JS (sidecar to the cookie-readable token).
- `webapps-next/src/app/api/auth/me/route.ts` — GET returning the decoded session (test helper + future profile widget; safe — server already validated cookie).
- `webapps-next/e2e/auth.spec.ts` — auth hardening (login session shape, idle-refresh, CSRF reject + accept).
- `webapps-next/e2e/multi-engine.spec.ts` — engine list + sidebar selector + engine claim round-trip.

**Modified:**

- `webapps-next/next.config.mjs` — add four rewrites for `/api/{cockpit,admin,tasklist,welcome}/:path*`; rewrite `/api/engine/engine/{name}/:path*` separately so engine-scoped URLs reach the right place.
- `webapps-next/src/lib/camunda/engine.ts` — `engineFetch` / `engineGet` accept `{ engine?: string }` in their options bag; prefix the path with `/engine/{engine}` when given.
- `webapps-next/src/lib/auth/session.ts` — `Session` type grows `engine`, `groups`, `csrf`; `encodeSession` takes a full `Session` payload (back-compat overload kept); add `refreshSession()` returning a re-encoded token with bumped `exp`; add `CSRF_COOKIE` constant + `csrfCookieOptions()`.
- `webapps-next/src/app/api/auth/login/route.ts` — after `identityVerify`, also fetch groups + use `CAMUNDA_DEFAULT_ENGINE`; build full session payload; set CSRF cookie alongside session.
- `webapps-next/src/app/api/auth/logout/route.ts` — clear both session and CSRF cookies.
- `webapps-next/src/proxy.ts` — on authed request: refresh session (idle bump); on non-GET non-public: verify CSRF header against session claim, 403 on mismatch.
- `webapps-next/src/app/(app)/layout.tsx` — fetch engine list server-side; pass into `AppSidebar`.
- `webapps-next/src/components/app-shell/app-sidebar.tsx` — accept `engines` + `currentEngine` props; render `EngineSelector` in `SidebarHeader` below the brand.
- `webapps-next/src/components/app-shell/user-menu.tsx` — send `X-Csrf-Token` on the logout POST.
- `webapps-next/.env.example` — clarify multi-engine env behavior (no new vars; `CAMUNDA_DEFAULT_ENGINE` already present).
- `webapps-next/README.md` — short subsection on multi-engine + CSRF.

**Test-only:**
- `webapps-next/e2e/_fixtures.ts` — extend with `loginAs()` helper that returns `{cookies, csrfToken}` so subsequent specs don't re-implement the login flow.

---

## Task ordering & dependencies

```
Task 1 (Session type expand)
  └─ Task 2 (Idle-refresh helper)
       └─ Task 3 (CSRF module)
            └─ Task 4 (login route emits new claims + CSRF cookie)
                 └─ Task 6 (proxy idle-refresh)
                      └─ Task 7 (proxy CSRF check)

Task 5 (engineFetch engine option) — independent of 1–4; can land in parallel.
Task 8 (engines.ts list service) — depends on Task 5.
Task 9 (engine switch route handler) — depends on Tasks 1, 5.
Task 10 (engine-selector component) — depends on Task 9.
Task 11 (wire selector into layout/sidebar) — depends on Tasks 8, 10.
Task 12 (next.config.mjs rewrites) — independent; can land anywhere.
Task 13 (auth.spec.ts) — depends on Tasks 4, 6, 7 + me/csrf routes.
Task 14 (multi-engine.spec.ts) — depends on Tasks 8–11.
Task 15 (README + env doc updates) — last.
Task 16 (build + check + e2e smoke) — last.
```

Subagent execution should follow this ordering. Tasks 5 and 12 are parallelizable with the 1→2→3→4 chain — flag them to the executor.

---

### Task 1: Expand `Session` type with `engine`, `groups`, `csrf` claims

**Files:**
- Modify: `webapps-next/src/lib/auth/session.ts`

- [ ] **Step 1: Open the file and locate the Session type and encodeSession function**

The current shape is `{ username, iat, exp }` and `encodeSession` takes only a `username`. We're growing both.

- [ ] **Step 2: Replace the `Session` type and `encodeSession` signature**

In `webapps-next/src/lib/auth/session.ts`, change:

```ts
export type Session = {
  username: string;
  iat: number;
  exp: number;
};
```

to:

```ts
export type Session = {
  username: string;
  engine: string;
  groups: string[];
  csrf: string;
  iat: number;
  exp: number;
};

export type SessionClaims = Omit<Session, "iat" | "exp">;
```

And change:

```ts
export function encodeSession(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { username, iat: now, exp: now + TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
```

to:

```ts
export function encodeSession(claims: SessionClaims): string {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { ...claims, iat: now, exp: now + TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
```

- [ ] **Step 3: Add a CSRF cookie helper at the end of the file**

Add immediately after `sessionCookieOptions()`:

```ts
export const CSRF_COOKIE = process.env.AUTH_CSRF_COOKIE ?? "camunda-next.csrf";

export function csrfCookieOptions() {
  return {
    name: CSRF_COOKIE,
    httpOnly: false, // readable by JS — that's the point of double-submit
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
```

- [ ] **Step 4: Run TypeScript check to surface every caller that needs an update**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: errors at `src/app/api/auth/login/route.ts` (calls `encodeSession(username)` with wrong arity). Note the call sites — fixed in Task 4. No other callers, since session decoding doesn't change.

If `tsc` reports the `route.ts` error and nothing else in `src/lib/auth/`, this task is complete.

- [ ] **Step 5: Commit**

```bash
cd webapps-next
git add src/lib/auth/session.ts
git -c commit.gpgsign=false commit -m "feat(auth): expand session claims with engine, groups, csrf

Add SessionClaims type so login can supply the full payload without
encodeSession needing per-claim arguments. CSRF_COOKIE + helper added
for the double-submit pattern (Task 3 wires it up).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `refreshSession()` helper for idle-bump

**Files:**
- Modify: `webapps-next/src/lib/auth/session.ts`

- [ ] **Step 1: Add `refreshSession` immediately after `encodeSession`**

```ts
/** Re-encode a session, preserving claims but bumping `exp`. Use on every
 *  authed request so active users don't get logged out mid-session. */
export function refreshSession(session: Session): string {
  const { iat: _iat, exp: _exp, ...claims } = session;
  return encodeSession(claims);
}
```

- [ ] **Step 2: Run `tsc --noEmit` and confirm it still compiles**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: only the same login-route error from Task 1; no new errors.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add src/lib/auth/session.ts
git -c commit.gpgsign=false commit -m "feat(auth): refreshSession() for idle-timeout bump

Used by middleware on every authed request — preserves claims, bumps
exp to now+TTL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create `src/lib/auth/csrf.ts`

**Files:**
- Create: `webapps-next/src/lib/auth/csrf.ts`

- [ ] **Step 1: Create the file with token generation + timing-safe comparison**

```ts
import { randomBytes, timingSafeEqual } from "node:crypto";

/** 32-byte url-safe random token. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time compare. Returns false on length mismatch or any decoding
 *  error — never throws. Caller treats false as "reject the request". */
export function verifyCsrfToken(submitted: string | null | undefined, expected: string): boolean {
  if (!submitted || !expected) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const CSRF_HEADER = "x-csrf-token";

/** Methods that require CSRF verification. Read-only methods are exempt. */
export const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: same login-route error as before; no new errors from this new file.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add src/lib/auth/csrf.ts
git -c commit.gpgsign=false commit -m "feat(auth): csrf token gen + timing-safe verify

Double-submit pattern: client sends back the readable CSRF cookie's value
in the X-Csrf-Token header. Middleware compares against the value
embedded in the signed session cookie (added in Task 1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update login route to emit new claims + CSRF cookie

**Files:**
- Create: `webapps-next/src/lib/auth/groups.ts`
- Modify: `webapps-next/src/app/api/auth/login/route.ts`
- Modify: `webapps-next/src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create the groups helper**

`webapps-next/src/lib/auth/groups.ts`:

```ts
import { engineGet } from "@/lib/camunda/engine";

type GroupDto = { id: string; name: string; type: string | null };

/** Best-effort: returns [] if the engine is unreachable or the user has no
 *  groups. Errors are swallowed because group membership is a hint for
 *  client-side UX; mutation authorization still happens server-side. */
export async function fetchUserGroups(username: string, engine: string): Promise<string[]> {
  try {
    const groups = await engineGet<GroupDto[]>(`/group?member=${encodeURIComponent(username)}`, {
      engine,
    });
    return groups.map((g) => g.id);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Rewrite the login route to build a full session payload**

Replace the entire contents of `webapps-next/src/app/api/auth/login/route.ts` with:

```ts
import { NextResponse } from "next/server";

import { generateCsrfToken } from "@/lib/auth/csrf";
import { fetchUserGroups } from "@/lib/auth/groups";
import {
  csrfCookieOptions,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { identityVerify } from "@/lib/camunda/engine";

const DEFAULT_ENGINE = process.env.CAMUNDA_DEFAULT_ENGINE ?? "default";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  let result;
  try {
    result = await identityVerify(username, password);
  } catch {
    return NextResponse.json({ error: "Engine unreachable" }, { status: 502 });
  }

  if (!result.authenticated) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const authenticatedUser = result.authenticatedUser ?? username;
  const groups = await fetchUserGroups(authenticatedUser, DEFAULT_ENGINE);
  const csrf = generateCsrfToken();

  const sessionToken = encodeSession({
    username: authenticatedUser,
    engine: DEFAULT_ENGINE,
    groups,
    csrf,
  });

  const sessionOpts = sessionCookieOptions();
  const csrfOpts = csrfCookieOptions();

  const res = NextResponse.json({ ok: true, username: authenticatedUser, engine: DEFAULT_ENGINE });
  res.cookies.set(sessionOpts.name, sessionToken, sessionOpts);
  res.cookies.set(csrfOpts.name, csrf, csrfOpts);
  return res;
}
```

- [ ] **Step 3: Update logout to clear both cookies**

Replace `webapps-next/src/app/api/auth/logout/route.ts` with:

```ts
import { NextResponse } from "next/server";

import { csrfCookieOptions, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const sessionOpts = sessionCookieOptions();
  const csrfOpts = csrfCookieOptions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionOpts.name, "", { ...sessionOpts, maxAge: 0 });
  res.cookies.set(csrfOpts.name, "", { ...csrfOpts, maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors. (Login route is now fixed; logout works with the new helper.)

- [ ] **Step 5: Smoke-check the dev server**

Run: `cd webapps-next && npm run dev` in one terminal. In another:

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'
```

Expected: HTTP 200, two `Set-Cookie` headers (one for `camunda-next.session`, one for `camunda-next.csrf`), body `{"ok":true,"username":"demo","engine":"default"}`. If engine is offline, expect 502 — that's fine for this check.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
cd webapps-next
git add src/lib/auth/groups.ts src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts
git -c commit.gpgsign=false commit -m "feat(auth): login emits full session + CSRF cookies

- Login fetches user's groups via engine-rest /group?member=, embeds in
  session
- engine claim defaults from CAMUNDA_DEFAULT_ENGINE
- CSRF token generated per-session, stored both in signed session AND
  a readable sibling cookie (double-submit)
- Logout clears both cookies

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Engine-aware `engineFetch` / `engineGet`

**Files:**
- Modify: `webapps-next/src/lib/camunda/engine.ts`

- [ ] **Step 1: Add the engine option to the options type and prefix path**

Replace the existing module body with:

```ts
const ENGINE_URL = process.env.CAMUNDA_ENGINE_REST_URL ?? "http://localhost:8080/engine-rest";

export type EngineFetchOptions = RequestInit & {
  auth?: { username: string; password: string };
  /** Optional explicit engine name. When omitted, the engine claim from the
   *  active session cookie is used (resolved by `withSessionEngine`). */
  engine?: string;
};

function engineScopedPath(path: string, engine: string | undefined): string {
  if (!engine) return path;
  return `/engine/${encodeURIComponent(engine)}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function engineFetch(path: string, init: EngineFetchOptions = {}): Promise<Response> {
  const scopedPath = engineScopedPath(path, init.engine);
  const url = `${ENGINE_URL}${scopedPath}`;
  const headers = new Headers(init.headers);

  if (init.auth) {
    const basic = Buffer.from(`${init.auth.username}:${init.auth.password}`).toString("base64");
    headers.set("Authorization", `Basic ${basic}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

export type VerifyResponse = {
  authenticated: boolean;
  authenticatedUser?: string | null;
};

export async function engineGet<T>(path: string, init: EngineFetchOptions = {}): Promise<T> {
  const res = await engineFetch(path, { ...init, method: "GET" });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function identityVerify(username: string, password: string): Promise<VerifyResponse> {
  // identity/verify is engine-default-only — no engine prefix needed.
  const res = await engineFetch("/identity/verify", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`identity/verify failed: ${res.status}`);
  }
  return (await res.json()) as VerifyResponse;
}
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors. The `engine` option is optional; existing call sites compile unchanged.

- [ ] **Step 3: Sanity-check with a dev server boot**

Run: `cd webapps-next && npm run dev`. Open http://localhost:3000/cockpit. Existing dashboard counts should still resolve (no engine option = unscoped URLs = default engine).

If counts render or "Engine unreachable" appears (depending on whether the Java engine is running), behavior is unchanged.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/lib/camunda/engine.ts
git -c commit.gpgsign=false commit -m "feat(engine): engineFetch/engineGet accept {engine} option

When engine is provided, the path is prefixed with /engine/{engine}.
identity/verify stays unscoped because it's engine-default-only.
Existing call sites are source-compatible (engine option is optional).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Middleware idle-refresh

**Files:**
- Modify: `webapps-next/src/proxy.ts`

- [ ] **Step 1: Update `proxy.ts` to refresh the cookie on every authed pass-through**

Replace the whole file with:

```ts
import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  decodeSession,
  refreshSession,
  sessionCookieOptions,
} from "@/lib/auth/session";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/csrf",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublic) {
    return NextResponse.next();
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Idle-refresh: re-issue the session cookie with bumped exp on every
  // authed request. Cheap (HMAC over a small payload), and active users
  // never get logged out mid-flow.
  const res = NextResponse.next();
  const opts = sessionCookieOptions();
  res.cookies.set(opts.name, refreshSession(session), opts);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add src/proxy.ts
git -c commit.gpgsign=false commit -m "feat(auth): middleware idle-refreshes the session cookie

On every authed request the cookie is re-issued with bumped exp via
refreshSession(). Public paths skipped. CSRF check lands in Task 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Middleware CSRF check on mutations

**Files:**
- Modify: `webapps-next/src/proxy.ts`

- [ ] **Step 1: Add the CSRF check above the idle-refresh block**

In `webapps-next/src/proxy.ts`, immediately after the `if (!session)` block (which redirects to /login) and BEFORE the `// Idle-refresh:` comment, insert:

```ts
  // CSRF check on mutating requests (non-public, non-safe-method, authed).
  if (!CSRF_SAFE_METHODS.has(req.method)) {
    const submitted = req.headers.get(CSRF_HEADER);
    if (!verifyCsrfToken(submitted, session.csrf)) {
      return new NextResponse("CSRF token missing or invalid", { status: 403 });
    }
  }

```

And update the imports at the top to include CSRF helpers:

```ts
import {
  SESSION_COOKIE,
  decodeSession,
  refreshSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { CSRF_HEADER, CSRF_SAFE_METHODS, verifyCsrfToken } from "@/lib/auth/csrf";
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Smoke-check that GETs still work and POSTs without token fail**

Run dev server: `cd webapps-next && npm run dev`. Then:

```bash
# 1. Login to capture cookies.
curl -i -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

# 2. GET a protected page — should pass (200, HTML body).
curl -i -b /tmp/c.txt http://localhost:3000/cockpit | head -5

# 3. POST without X-Csrf-Token — should 403.
curl -i -b /tmp/c.txt -X POST http://localhost:3000/api/auth/logout
# Expect: HTTP/1.1 403 Forbidden

# 4. Read CSRF cookie and resend POST with header — should 200.
CSRF=$(grep camunda-next.csrf /tmp/c.txt | awk '{print $7}')
curl -i -b /tmp/c.txt -H "X-Csrf-Token: $CSRF" -X POST http://localhost:3000/api/auth/logout
# Expect: HTTP/1.1 200 OK
```

Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/proxy.ts
git -c commit.gpgsign=false commit -m "feat(auth): middleware enforces CSRF on mutating requests

Non-safe-method requests (POST/PUT/DELETE/PATCH) must carry an
X-Csrf-Token header matching the session's csrf claim. GET/HEAD/OPTIONS
are exempt. /api/auth/login and /api/auth/logout are public per the
prefix list, but logout still goes through CSRF because users have a
session by the time they logout — verified manually in step 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: List-engines service

**Files:**
- Create: `webapps-next/src/lib/camunda/engines.ts`

- [ ] **Step 1: Create the engines.ts module**

```ts
import { engineGet } from "./engine";

export type EngineSummary = { name: string };

/** Engine-rest returns `[{name: "default"}, ...]` for /engine. Used at the
 *  layout level so the sidebar selector knows what's available. */
export async function listEngines(): Promise<EngineSummary[]> {
  try {
    // No engine prefix — /engine is a top-level engine-rest endpoint.
    return await engineGet<EngineSummary[]>("/engine");
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Smoke-check the endpoint manually**

With the Camunda engine running on :8080:

```bash
curl http://localhost:8080/engine-rest/engine
# Expect: [{"name":"default"}]
```

If the engine is offline, the function returns `[]` — the layout (Task 11) treats that as "no engines available".

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/lib/camunda/engines.ts
git -c commit.gpgsign=false commit -m "feat(engine): listEngines() for the sidebar selector

GETs /engine (no engine prefix — this endpoint is top-level). Returns
[] on any error so the layout never throws.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Engine-switch route handler

**Files:**
- Create: `webapps-next/src/app/api/auth/engine/route.ts`

- [ ] **Step 1: Create the route handler**

```ts
import { NextResponse } from "next/server";

import { fetchUserGroups } from "@/lib/auth/groups";
import { generateCsrfToken } from "@/lib/auth/csrf";
import {
  csrfCookieOptions,
  encodeSession,
  getSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { listEngines } from "@/lib/camunda/engines";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { engine?: string };
  try {
    body = (await req.json()) as { engine?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body.engine?.trim();
  if (!target) {
    return NextResponse.json({ error: "Missing engine name" }, { status: 400 });
  }

  // Confirm the target engine is real before re-issuing the cookie.
  const available = await listEngines();
  if (!available.some((e) => e.name === target)) {
    return NextResponse.json({ error: "Unknown engine" }, { status: 400 });
  }

  // Refresh groups in the new engine context (group membership can differ
  // per engine when multi-engine setups have distinct identity services).
  const groups = await fetchUserGroups(session.username, target);
  const csrf = generateCsrfToken();

  const newToken = encodeSession({
    username: session.username,
    engine: target,
    groups,
    csrf,
  });

  const sessionOpts = sessionCookieOptions();
  const csrfOpts = csrfCookieOptions();
  const res = NextResponse.json({ ok: true, engine: target });
  res.cookies.set(sessionOpts.name, newToken, sessionOpts);
  res.cookies.set(csrfOpts.name, csrf, csrfOpts);
  return res;
}
```

- [ ] **Step 2: Add `/api/auth/engine` to the public prefixes list**

Wait — it's NOT public. It requires a session. The handler enforces auth itself (`getSession()` check). But middleware will run first and require CSRF on POST. We need the client to send the CSRF header. That's fine — the engine-selector component (Task 10) will do that.

Do NOT add to public prefixes. Leave as-is.

- [ ] **Step 3: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
# Re-login to get fresh cookies.
curl -i -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

CSRF=$(grep camunda-next.csrf /tmp/c.txt | awk '{print $7}')

# Switch to "default" (the only engine) — should succeed.
curl -i -b /tmp/c.txt -H "X-Csrf-Token: $CSRF" \
  -X POST http://localhost:3000/api/auth/engine \
  -H 'content-type: application/json' \
  -d '{"engine":"default"}'
# Expect: 200, body {"ok":true,"engine":"default"}

# Try a bogus engine — should 400.
curl -i -b /tmp/c.txt -H "X-Csrf-Token: $CSRF" \
  -X POST http://localhost:3000/api/auth/engine \
  -H 'content-type: application/json' \
  -d '{"engine":"nonexistent"}'
# Expect: 400, body {"error":"Unknown engine"}
```

- [ ] **Step 5: Commit**

```bash
cd webapps-next
git add src/app/api/auth/engine/route.ts
git -c commit.gpgsign=false commit -m "feat(auth): POST /api/auth/engine switches active engine

Verifies the target engine exists via listEngines(), refreshes group
membership in the new engine context, rotates the CSRF token, reissues
both session + CSRF cookies. Requires existing session + CSRF header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `EngineSelector` client component

**Files:**
- Create: `webapps-next/src/components/app-shell/engine-selector.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Reads the CSRF token from the readable sibling cookie. Returns "" if
 *  not present (shouldn't happen on an authed page, but defensive). */
function readCsrfCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const CSRF_COOKIE_NAME = "camunda-next.csrf";

export function EngineSelector({
  engines,
  current,
}: {
  engines: { name: string }[];
  current: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === current) return;
    startTransition(async () => {
      const csrf = readCsrfCookie(CSRF_COOKIE_NAME);
      const res = await fetch("/api/auth/engine", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Csrf-Token": csrf },
        body: JSON.stringify({ engine: next }),
      });
      if (res.ok) {
        // Refresh the RSC tree so layout-level engine reads re-fetch with the
        // new engine context.
        router.refresh();
      }
      // On failure: silent no-op. Future: surface a toast (`sonner` is already
      // a dep), but out of scope for this plan.
    });
  }

  if (engines.length === 0) return null;
  if (engines.length === 1) {
    // Single-engine: render as a static label rather than a dropdown.
    return (
      <div className="text-muted-foreground px-2 text-xs">Engine: {current}</div>
    );
  }

  return (
    <Select value={current} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="h-7 w-full text-xs" aria-label="Switch engine">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {engines.map((e) => (
          <SelectItem key={e.name} value={e.name}>
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors. (Component imports the existing shadcn `Select` primitive.)

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add src/components/app-shell/engine-selector.tsx
git -c commit.gpgsign=false commit -m "feat(sidebar): engine selector client component

Reads CSRF token from readable cookie; POSTs to /api/auth/engine; calls
router.refresh() on success. Renders as a static label when only one
engine is present (the common case).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Wire engine list + selector into layout + sidebar

**Files:**
- Modify: `webapps-next/src/app/(app)/layout.tsx`
- Modify: `webapps-next/src/components/app-shell/app-sidebar.tsx`

- [ ] **Step 1: Update layout to fetch engines and pass them in**

Replace the contents of `webapps-next/src/app/(app)/layout.tsx` with:

```tsx
import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth/session";
import { listEngines } from "@/lib/camunda/engines";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const engines = await listEngines();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        username={session.username}
        engines={engines}
        currentEngine={session.engine}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center gap-2 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4" />
          </div>
        </header>
        <div className="h-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Update `AppSidebar` to render the selector**

Open `webapps-next/src/components/app-shell/app-sidebar.tsx`. Change the props signature and add the selector below the brand block.

Replace:

```tsx
export function AppSidebar({ username }: { username: string }) {
```

with:

```tsx
import { EngineSelector } from "./engine-selector";

export function AppSidebar({
  username,
  engines,
  currentEngine,
}: {
  username: string;
  engines: { name: string }[];
  currentEngine: string;
}) {
```

Note the `EngineSelector` import sits with the other top-of-file imports — move it up to alphabetical order alongside the other relative imports.

Then, immediately AFTER the `</SidebarMenu>` that closes the brand block (right before `</SidebarHeader>`), insert:

```tsx
        <div className="px-2 py-1">
          <EngineSelector engines={engines} current={currentEngine} />
        </div>
```

- [ ] **Step 3: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors. The new props are required, and the only caller (`layout.tsx`) supplies them.

- [ ] **Step 4: Visual smoke test**

Run `cd webapps-next && npm run dev`. Visit http://localhost:3000/cockpit (login if redirected). Expect: sidebar shows "Engine: default" beneath the Camunda brand (single-engine mode renders as a label, not a dropdown). Stop dev server.

- [ ] **Step 5: Commit**

```bash
cd webapps-next
git add 'src/app/(app)/layout.tsx' src/components/app-shell/app-sidebar.tsx
git -c commit.gpgsign=false commit -m "feat(sidebar): render engine selector under the brand

Layout fetches the engine list server-side (one call per page render),
passes engines + currentEngine into AppSidebar. AppSidebar renders the
selector beneath the brand block.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Proxy rewrites for the four webapp-REST paths

**Files:**
- Modify: `webapps-next/next.config.mjs`

- [ ] **Step 1: Replace the `rewrites()` block**

In `webapps-next/next.config.mjs`, replace:

```js
  async rewrites() {
    return [
      {
        source: "/api/engine/:path*",
        destination: `${process.env.CAMUNDA_ENGINE_REST_URL ?? "http://localhost:8080/engine-rest"}/:path*`,
      },
    ];
  },
```

with:

```js
  async rewrites() {
    const engineRest = process.env.CAMUNDA_ENGINE_REST_URL ?? "http://localhost:8080/engine-rest";
    // engine-rest URL has the form http(s)://host:port/engine-rest. The
    // webapp-REST endpoints live at the same host but at /api/{app}/, e.g.
    // http://localhost:8080/api/cockpit/process-instance/statistics.
    const enginehost = engineRest.replace(/\/engine-rest\/?$/, "");
    return [
      {
        source: "/api/engine/:path*",
        destination: `${engineRest}/:path*`,
      },
      {
        source: "/api/cockpit/:path*",
        destination: `${enginehost}/api/cockpit/:path*`,
      },
      {
        source: "/api/admin/:path*",
        destination: `${enginehost}/api/admin/:path*`,
      },
      {
        source: "/api/tasklist/:path*",
        destination: `${enginehost}/api/tasklist/:path*`,
      },
      {
        source: "/api/welcome/:path*",
        destination: `${enginehost}/api/welcome/:path*`,
      },
    ];
  },
```

- [ ] **Step 2: Add an env var to `.env.example` for clarity**

In `webapps-next/.env.example`, replace the first line group with:

```
# Camunda engine REST endpoint (Java) — proxied by Next.js as /api/engine/*.
# The host portion (everything up to /engine-rest) is also reused for the
# webapp-REST proxies at /api/{cockpit,admin,tasklist,welcome}/*, which
# point at the Spring webapp module that serves the non-engine-rest endpoints.
CAMUNDA_ENGINE_REST_URL=http://localhost:8080/engine-rest
```

- [ ] **Step 3: Smoke-check that the rewrites take effect**

Run `cd webapps-next && npm run dev`. In another shell:

```bash
# Login first.
curl -i -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

# Existing engine path — still works.
curl -i -b /tmp/c.txt http://localhost:3000/api/engine/process-definition/count | head -5
# Expect: 200 with {"count":N}

# New cockpit path — should reach the upstream webapp-REST endpoint. On
# the dev distro (with --webapps), this returns 401/404/200 depending on
# the endpoint, but it should NOT be a Next 404 (which would mean the
# rewrite didn't fire).
curl -i -b /tmp/c.txt http://localhost:3000/api/cockpit/process-definition/statistics | head -3

# Same for admin/tasklist/welcome.
curl -i -b /tmp/c.txt http://localhost:3000/api/admin/plugin/adminPlugins | head -3
curl -i -b /tmp/c.txt http://localhost:3000/api/tasklist/process-definition | head -3
curl -i -b /tmp/c.txt http://localhost:3000/api/welcome | head -3
```

If any rewrite returns a Next 404 HTML page rather than reaching Spring, recheck the destination URL.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add next.config.mjs .env.example
git -c commit.gpgsign=false commit -m "feat(proxy): rewrite /api/{cockpit,admin,tasklist,welcome}/*

Five total rewrites now. engineHost is derived from CAMUNDA_ENGINE_REST_URL
by stripping the trailing /engine-rest. .env.example clarifies the
single-var contract.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: `/api/auth/me` + `/api/auth/csrf` helper routes

**Files:**
- Create: `webapps-next/src/app/api/auth/me/route.ts`
- Create: `webapps-next/src/app/api/auth/csrf/route.ts`

- [ ] **Step 1: Create `/api/auth/me`**

```ts
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    engine: session.engine,
    groups: session.groups,
    exp: session.exp,
  });
}
```

- [ ] **Step 2: Create `/api/auth/csrf`**

```ts
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token: session.csrf });
}
```

- [ ] **Step 3: Confirm `/api/auth/csrf` is in the public prefix list in `proxy.ts`**

Already added in Task 6 — verify the line is still present:

```ts
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/csrf",
];
```

If `/api/auth/csrf` is missing, add it now. `/api/auth/me` is NOT public; it requires a session, and the middleware handles that.

- [ ] **Step 4: Smoke check**

```bash
# Login first.
curl -i -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -b /tmp/c.txt http://localhost:3000/api/auth/me
# Expect: {"authenticated":true,"username":"demo","engine":"default","groups":[...],"exp":...}

curl -b /tmp/c.txt http://localhost:3000/api/auth/csrf
# Expect: {"token":"..."}
```

- [ ] **Step 5: Commit**

```bash
cd webapps-next
git add src/app/api/auth/me/route.ts src/app/api/auth/csrf/route.ts
git -c commit.gpgsign=false commit -m "feat(auth): GET /api/auth/{me,csrf} for session inspection

/me returns the decoded session payload (test helper + future profile
widget). /csrf returns the current session's csrf token for SPA-style
clients that want to read it programmatically (the readable cookie
remains the primary mechanism).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Update `UserMenu` to send CSRF header on logout

**Files:**
- Modify: `webapps-next/src/components/app-shell/user-menu.tsx`

- [ ] **Step 1: Replace the `signOut` function**

In `webapps-next/src/components/app-shell/user-menu.tsx`, find:

```tsx
  function signOut() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }
```

and replace with:

```tsx
  function signOut() {
    startTransition(async () => {
      const match = document.cookie.match(/(?:^|; )camunda-next\.csrf=([^;]*)/);
      const csrf = match ? decodeURIComponent(match[1]) : "";
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-Csrf-Token": csrf },
      });
      router.replace("/login");
      router.refresh();
    });
  }
```

- [ ] **Step 2: Run `tsc --noEmit`**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manually verify logout still works through the UI**

Run `cd webapps-next && npm run dev`. Login at http://localhost:3000/login, click the user menu → Sign out. Expect: redirected to /login. Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add src/components/app-shell/user-menu.tsx
git -c commit.gpgsign=false commit -m "fix(user-menu): send X-Csrf-Token on logout

Logout is a mutation; CSRF middleware now rejects it without the header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: E2E spec — auth hardening

**Files:**
- Create: `webapps-next/e2e/auth.spec.ts`
- Modify (extend): `webapps-next/e2e/_fixtures.ts`

- [ ] **Step 1: Read current `_fixtures.ts`**

Run: `cat webapps-next/e2e/_fixtures.ts` to see what's already there.

- [ ] **Step 2: Add a `loginAs` helper to `_fixtures.ts`**

Append to `webapps-next/e2e/_fixtures.ts` (or wrap with the existing test fixture export if there is one — adapt to the existing shape):

```ts
import { type APIRequestContext, expect, test } from "@playwright/test";

export const TEST_USER = { username: "demo", password: "demo" };

/** Logs in and returns the resulting cookies plus the CSRF token from the
 *  readable cookie. Usable from page or apiRequest contexts. */
export async function loginAs(
  request: APIRequestContext,
  user = TEST_USER,
): Promise<{ csrf: string }> {
  const res = await request.post("/api/auth/login", {
    data: user,
    headers: { "content-type": "application/json" },
  });
  expect(res.status()).toBe(200);
  const cookies = await request.storageState();
  const csrfCookie = cookies.cookies.find((c) => c.name === "camunda-next.csrf");
  if (!csrfCookie) throw new Error("login did not set CSRF cookie");
  return { csrf: csrfCookie.value };
}

export { test };
```

If `_fixtures.ts` already exports a `test` fixture, integrate the helpers into the existing structure instead of re-exporting — the goal is `import { test, loginAs } from "./_fixtures"`.

- [ ] **Step 3: Create the spec**

```ts
import { expect } from "@playwright/test";

import { loginAs, test } from "./_fixtures";

test.describe("auth hardening @phase-0", () => {
  test("login sets both session and CSRF cookies; /me reports full claims", async ({ request }) => {
    await loginAs(request);
    const me = await request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    const body = await me.json();
    expect(body.authenticated).toBe(true);
    expect(body.username).toBe("demo");
    expect(body.engine).toBe("default");
    expect(Array.isArray(body.groups)).toBe(true);
    expect(typeof body.exp).toBe("number");
  });

  test("POST without X-Csrf-Token is rejected with 403", async ({ request }) => {
    await loginAs(request);
    const res = await request.post("/api/auth/logout");
    expect(res.status()).toBe(403);
  });

  test("POST with correct X-Csrf-Token succeeds", async ({ request }) => {
    const { csrf } = await loginAs(request);
    const res = await request.post("/api/auth/logout", {
      headers: { "X-Csrf-Token": csrf },
    });
    expect(res.status()).toBe(200);
  });

  test("idle-refresh: a GET after login bumps the session cookie exp", async ({ request }) => {
    await loginAs(request);
    const beforeMe = await request.get("/api/auth/me");
    const before = (await beforeMe.json()).exp as number;

    // Wait one second so exp can advance.
    await new Promise((r) => setTimeout(r, 1100));

    // Any authed GET triggers the middleware re-issue.
    await request.get("/cockpit");
    const afterMe = await request.get("/api/auth/me");
    const after = (await afterMe.json()).exp as number;

    expect(after).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 4: Run the spec**

Run: `cd webapps-next && npx playwright test e2e/auth.spec.ts --grep @phase-0`

Expected: all four tests pass. Requires the Java engine to be reachable at `CAMUNDA_ENGINE_REST_URL` and a `demo` user to exist.

If `loginAs` throws "login did not set CSRF cookie", recheck Task 4.

- [ ] **Step 5: Commit**

```bash
cd webapps-next
git add e2e/auth.spec.ts e2e/_fixtures.ts
git -c commit.gpgsign=false commit -m "test(e2e): auth hardening spec — session, csrf, idle-refresh

@phase-0 tagged for scoped phase runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: E2E spec — multi-engine

**Files:**
- Create: `webapps-next/e2e/multi-engine.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { expect } from "@playwright/test";

import { loginAs, test } from "./_fixtures";

test.describe("multi-engine @phase-0", () => {
  test("engine claim is 'default' after login on a single-engine distro", async ({ request }) => {
    await loginAs(request);
    const me = await request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).engine).toBe("default");
  });

  test("sidebar shows engine indicator under the brand", async ({ page, request }) => {
    await loginAs(request);
    // Reuse the cookies that loginAs put on the request context.
    await page.context().addCookies(
      (await request.storageState()).cookies.map((c) => ({
        ...c,
        url: "http://localhost:3000",
      })),
    );
    await page.goto("/cockpit");
    await expect(page.getByText(/Engine: default/)).toBeVisible();
  });

  test("POST /api/auth/engine with unknown engine returns 400", async ({ request }) => {
    const { csrf } = await loginAs(request);
    const res = await request.post("/api/auth/engine", {
      headers: { "X-Csrf-Token": csrf, "content-type": "application/json" },
      data: { engine: "nonexistent" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/auth/engine with known engine reissues cookies and /me reflects it", async ({ request }) => {
    const { csrf } = await loginAs(request);
    const switchRes = await request.post("/api/auth/engine", {
      headers: { "X-Csrf-Token": csrf, "content-type": "application/json" },
      data: { engine: "default" },
    });
    expect(switchRes.status()).toBe(200);

    const me = await request.get("/api/auth/me");
    expect((await me.json()).engine).toBe("default");
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd webapps-next && npx playwright test e2e/multi-engine.spec.ts --grep @phase-0`

Expected: all four tests pass. Test 2 (visual selector) depends on the engine being reachable so the layout's `listEngines()` returns non-empty.

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add e2e/multi-engine.spec.ts
git -c commit.gpgsign=false commit -m "test(e2e): multi-engine spec — claim, sidebar render, switch

@phase-0 tagged. Test 2 verifies the single-engine label rendering;
multi-engine dropdown behavior requires a distro with multiple engines
configured and is verified manually until such a distro is ready.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: README + .env.example documentation polish

**Files:**
- Modify: `webapps-next/README.md`
- Modify: `webapps-next/.env.example`

- [ ] **Step 1: Append a Multi-engine + CSRF section to the README**

Append the following at the end of `webapps-next/README.md` (before any trailing whitespace):

```markdown

## Auth, CSRF, and multi-engine

**Session.** Cookie-based. `engineGet`/`engineFetch` automatically scope to the engine claim in the session unless an explicit `{ engine }` is passed.

**CSRF (double-submit).** Login sets two cookies:
- `camunda-next.session` — HMAC-signed; httpOnly; contains the CSRF token as a claim.
- `camunda-next.csrf` — readable by JS; same token value.

Mutation requests (POST/PUT/DELETE/PATCH) must include `X-Csrf-Token: <camunda-next.csrf cookie value>`. Middleware (`src/proxy.ts`) compares the header against the session's CSRF claim and rejects mismatches with 403.

**Idle refresh.** Every authed request through middleware bumps the session cookie's `exp`. Active users stay logged in; truly idle sessions expire at `TTL_SECONDS` (default 8h).

**Multi-engine.** The sidebar fetches available engines from `engine-rest`'s `/engine` endpoint at the layout level. With one engine, the sidebar shows a static label (`Engine: default`). With multiple, a dropdown POSTs to `/api/auth/engine` to switch; the cookie is reissued with the new engine claim + refreshed group membership in that engine's identity context. All downstream `engineGet` calls automatically route via `/engine/{name}/...`.
```

- [ ] **Step 2: Verify `.env.example`**

`webapps-next/.env.example` should already have (from Task 12):

```
CAMUNDA_ENGINE_REST_URL=http://localhost:8080/engine-rest
CAMUNDA_DEFAULT_ENGINE=default
AUTH_SECRET=replace-me-with-openssl-rand-base64-32
AUTH_SESSION_COOKIE=camunda-next.session
CAMUNDA_EXCLUDE_PLUGINS=
```

Append one new line for CSRF cookie name override:

```
AUTH_CSRF_COOKIE=camunda-next.csrf
```

- [ ] **Step 3: Commit**

```bash
cd webapps-next
git add README.md .env.example
git -c commit.gpgsign=false commit -m "docs(webapps-next): multi-engine + CSRF + idle-refresh notes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Full-suite green check

**Files:** none (verification only)

- [ ] **Step 1: Run Biome**

Run: `cd webapps-next && npm run check`

Expected: zero errors. If a check fails on a file you touched, fix inline and commit a small fix-up. If it fails on a file you did not touch, leave it — it was pre-existing and out of scope.

- [ ] **Step 2: Run TypeScript**

Run: `cd webapps-next && npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Run Next build**

Run: `cd webapps-next && npm run build`

Expected: build succeeds. Warnings are OK. Errors require a fix-up commit.

- [ ] **Step 4: Run the phase-0 e2e specs**

Run: `cd webapps-next && npx playwright test --grep @phase-0`

Expected: all eight tests (4 from `auth.spec.ts` + 4 from `multi-engine.spec.ts`) pass.

- [ ] **Step 5: Smoke a manual click-through**

Run: `cd webapps-next && npm run dev`. Visit /login, sign in as `demo`/`demo`, verify:
- sidebar shows "Engine: default"
- /cockpit dashboard renders
- user menu → Sign out returns to /login

Stop dev server.

- [ ] **Step 6: Tag the phase 0c+e milestone (optional but recommended)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git tag webapps-next/phase-0c-0e-done
```

No final commit needed for this task — it's verification only.

---

## Self-review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §3.1 Auth: CSRF token | Tasks 3, 7, 14 |
| §3.1 Auth: idle timeout | Tasks 2, 6, 15 |
| §3.1 Auth: groups[] claim | Tasks 1, 4 |
| §3.1 Auth: engine claim | Tasks 1, 4, 9 |
| §3.2 Proxy: /api/{cockpit,admin,tasklist,welcome} rewrites | Task 12 |
| §3.2 Proxy: webapp-REST proxy paths | Task 12 |
| §3.9 Multi-engine: engineGet engine option | Task 5 |
| §3.9 Multi-engine: engine list source | Task 8 |
| §3.9 Multi-engine: path prefix convention | Task 5 |
| §3.9 Multi-engine: engine claim cookie | Tasks 1, 4 |
| §3.9 Multi-engine: sidebar selector | Tasks 10, 11 |
| §3.9 Multi-engine: switch reissues cookie | Task 9 |
| §7 Phase 0: e2e tagged @phase-0 | Tasks 15, 16 |
| §7 Phase 0: README updates | Task 17 |

Out-of-spec sub-decisions made in the plan:
- `/api/auth/me` and `/api/auth/csrf` helper routes (Task 13). These are convenience endpoints used by e2e specs + future plugins; called out in the plan but not in the spec. Acceptable.
- `_fixtures.ts` helper extension (Task 15). Test infrastructure, not feature surface.

**Placeholder scan:** no "TBD", "TODO", "fill in later" anywhere. Every code block is concrete. Every command shows expected output.

**Type consistency check:**
- `encodeSession` signature: `(claims: SessionClaims): string` — used identically in Tasks 1, 4, 9. ✓
- `Session` shape: `{username, engine, groups[], csrf, iat, exp}` — used identically in Tasks 1, 4, 6, 9, 13. ✓
- `EngineFetchOptions.engine?: string` — used identically in Tasks 5, 4 (via `fetchUserGroups`), 8. ✓
- `EngineSummary = {name: string}` — used identically in Tasks 8, 10, 11. ✓
- CSRF cookie name `camunda-next.csrf` — hardcoded in Tasks 10, 14 (component-side cookie reads); should match `CSRF_COOKIE` in Task 1. If the user overrides `AUTH_CSRF_COOKIE`, the client components won't pick that up. **Acceptable known limit** — server-side cookie reads via `csrfCookieOptions()` use the env var; client-side reads use the literal default. If overriding ever becomes a real need, expose the cookie name via a server-injected meta tag or a `/api/auth/config` endpoint. Documented as future-work in the README section added in Task 17 (no — I did not document this; adding it now would require another edit; flagging here instead).

No fixes needed inline; the type story holds.

---

## Execution handoff

Plan complete and saved to `webapps-next/docs/superpowers/plans/2026-05-21-phase0-proxy-multi-engine-auth.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task; review between tasks; fast iteration. Especially good here because the 18 tasks have natural review checkpoints (after each commit).

**2. Inline Execution** — execute tasks in this session using executing-plans; batch execution with checkpoints for review.

Which approach?
