# camunda-next-webapps

Next.js rewrite of the Camunda Platform webapps (Cockpit, Tasklist, Admin, Welcome).
Sits alongside the existing AngularJS-based `webapps/` during migration.

## What's in scope

This app **replaces** `webapps/frontend/` (AngularJS UI) and `webapps/assembly/` (Spring servlet).
It **does not** replace `engine/` or `engine-rest/` — those stay Java and are this app's source of truth
for process, identity, and authorization state.

## Stack

- **Next.js 16** (App Router, RSC)
- **React 19** + TypeScript
- **Tailwind 4** + **shadcn/ui** (new-york style)
- **TanStack Query** + **TanStack Table**
- **bpmn-js / dmn-js / cmmn-js / @bpmn-io/form-js** — diagram + form rendering
- **next-intl** — i18n (migration target for the existing `locales/{en,de}.json` files)
- **Biome** — lint/format
- **Playwright** — e2e
- **Zod**, **React Hook Form**, **Zustand**, **Sonner**, **Radix UI**, **Lucide**

No database. Engine state is read/written via `engine-rest` proxied through `/api/engine/*`.

## Layout

```
webapps-next/
├── src/
│   ├── app/                 Next.js App Router (cockpit, tasklist, admin, welcome will live here)
│   ├── components/ui/       shadcn primitives (copied from cargotrain reference)
│   ├── lib/                 utils, camunda client, plugin loader
│   ├── hooks/               shared React hooks
│   ├── stores/              zustand stores
│   ├── server/              server-only modules
│   ├── styles/              additional CSS
│   ├── config/              app config
│   └── types/               shared TS types
├── plugins/                 first-party plugins (see migration blueprint §4.3)
├── plugins-samples/         reference plugin implementations
├── e2e/                     Playwright specs
├── public/
└── docker/
```

## Getting started

```bash
cd webapps-next
npm install        # or: bun install
cp .env.example .env.local
# Make sure the Java engine is running at $CAMUNDA_ENGINE_REST_URL (default http://localhost:8080/engine-rest)
npm run dev
```

The app boots on http://localhost:3000.

## Migration context

See the discussion in the parent repo for the full migration blueprint, including:

- Component-by-component mapping of `webapps/assembly/` and `webapps/frontend/` to this app
- Auth model (NextAuth Credentials → `engine-rest/identity/verify`)
- Plugin contract spec (`plugin.json`, extension-point names, client/server entry conventions)
- Phasing recommendation (Tasklist → Welcome+Admin → Cockpit → plugin parity → cutover)
