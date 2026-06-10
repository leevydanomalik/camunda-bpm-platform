"use client";

import { useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  EyeOff,
  Inbox,
  Layers,
  LayoutDashboard,
  ListChecks,
  Menu,
  Package,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Users,
  Workflow,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { HeroFlow } from "./hero-flow";
import { Reveal } from "./reveal";

export type LiveStats = {
  definitions: number | null;
  instances: number | null;
  tasks: number | null;
  decisions: number | null;
  deployments: number | null;
  incidents: number | null;
};

type NavItem = { title: string; href: string; desc: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

// Grouped dropdown nav — every item links to a real route (auth-gated; the
// login page preserves the deep link) or an on-page section anchor.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { title: "Dashboard", href: "/cockpit", desc: "Executive overview & KPIs", icon: LayoutDashboard },
      { title: "Processes", href: "/cockpit/processes", desc: "Definitions, instances & heatmaps", icon: Workflow },
      { title: "Decisions", href: "/cockpit/decisions", desc: "DMN tables & evaluations", icon: Table2 },
      { title: "Inbox", href: "/tasklist", desc: "Your human tasks", icon: Inbox },
    ],
  },
  {
    label: "Operate",
    items: [
      { title: "Tasks", href: "/cockpit/tasks", desc: "Task operations across processes", icon: ListChecks },
      { title: "Batches", href: "/cockpit/batches", desc: "Bulk operations at scale", icon: Layers },
      { title: "Deployments", href: "/cockpit/deployments", desc: "Everything on the engine", icon: Package },
    ],
  },
  {
    label: "Govern",
    items: [
      { title: "Users", href: "/admin/users", desc: "Accounts & profiles", icon: Users },
      { title: "Authorizations", href: "/admin/authorizations", desc: "Who can do what", icon: ShieldCheck },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "How it works", href: "#how", desc: "Deploy, operate, improve", icon: ClipboardList },
      { title: "All modules", href: "#modules", desc: "Browse the platform", icon: LayoutDashboard },
      { title: "Login", href: "/login", desc: "Sign in to your engine", icon: Users },
    ],
  },
];

// Hero chips — the headline capabilities.
const CHIPS = ["BPMN 2.0", "DMN decisions", "Tasklist", "Heatmaps", "AI insights", "Batch ops"];

// The pains DEEPFLOW removes.
const CHALLENGES = [
  {
    icon: EyeOff,
    title: "No live picture",
    desc: "Running instances, incidents and load are scattered across screens — you find problems after they hurt.",
  },
  {
    icon: AlertTriangle,
    title: "Incidents surface too late",
    desc: "Failed jobs sit silent until somebody greps a log. Triage is slow, manual and stressful.",
  },
  {
    icon: Inbox,
    title: "Tasks stall in inboxes",
    desc: "Human tasks wait unassigned — no notifications, no priorities surfaced, no due-date pressure.",
  },
  {
    icon: Wrench,
    title: "Risky manual operations",
    desc: "Retrying, suspending and migrating by hand against raw REST endpoints is error-prone at 2 a.m.",
  },
];

// What the platform does about them.
const SOLUTIONS = [
  "Heatmaps paint live token load and incidents straight onto your BPMN diagrams",
  "AI executive summaries explain any process or dashboard in plain language",
  "One-click operate: claim, complete, retry and batch operations with guardrails",
  "Task notifications with badges and toasts the moment work lands on you",
];

const RESULTS = [
  { value: "3 → 1", label: "Cockpit, Tasklist & Admin unified into one console" },
  { value: "9", label: "Connected modules, one navigation" },
  { value: "AI", label: "Executive summaries & insights on demand" },
  { value: "100%", label: "Engine-native REST — zero lock-in" },
];

// Every "Open" links to a real, auth-gated module route.
const MODULES = [
  {
    icon: LayoutDashboard,
    badge: "AI inside",
    title: "Dashboard",
    desc: "An executive report of your engine — KPIs, activity timelines, incidents and AI-written insights.",
    href: "/cockpit",
  },
  {
    icon: Workflow,
    title: "Processes",
    desc: "Definitions, versions and instances with live heatmaps, diagram controls and Ask-AI interpretation.",
    href: "/cockpit/processes",
  },
  {
    icon: Table2,
    title: "Decisions",
    desc: "DMN decision tables and DRDs, fully themed, with evaluation history at your fingertips.",
    href: "/cockpit/decisions",
  },
  {
    icon: Inbox,
    badge: "Notifications",
    title: "Inbox",
    desc: "Claim, complete and comment on your tasks — forms, history, due dates and a bell that tells you first.",
    href: "/tasklist",
  },
  {
    icon: ListChecks,
    title: "Tasks",
    desc: "The operational view of every human task across all running processes.",
    href: "/cockpit/tasks",
  },
  {
    icon: Layers,
    title: "Batches",
    desc: "Monitor and manage long-running batch operations without leaving the console.",
    href: "/cockpit/batches",
  },
  {
    icon: Package,
    title: "Deployments",
    desc: "Browse every deployment and resource on the engine — BPMN and DMN definitions included.",
    href: "/cockpit/deployments",
  },
  {
    icon: Users,
    title: "Users & Groups",
    desc: "Manage accounts, group membership and profiles against the engine's identity service.",
    href: "/admin/users",
  },
  {
    icon: ShieldCheck,
    title: "Authorizations",
    desc: "Fine-grained, engine-enforced access control — who sees and operates what.",
    href: "/admin/authorizations",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Deploy",
    desc: "Ship BPMN & DMN to the engine. Deployments, definitions and diagrams appear in DEEPFLOW instantly.",
  },
  {
    n: "02",
    title: "Operate",
    desc: "Watch live dashboards, work the tasklist, retry incidents and run batch operations from one place.",
  },
  {
    n: "03",
    title: "Improve",
    desc: "Read AI executive summaries and heatmaps — find the bottleneck before it finds you.",
  },
];

const ENGINE_FACTS = [
  "BPMN 2.0 & DMN 1.3 rendering",
  "Full history & audit trail",
  "Engine-enforced authorizations",
  "Incidents, retries & job control",
  "Human task lifecycle & forms",
  "Batch operations",
  "Multi-tenancy aware",
  "Camunda 7 compatible REST",
];

function fmt(n: number | null): string {
  return n == null ? "—" : new Intl.NumberFormat().format(n);
}

/* A single grouped dropdown in the top nav. */
function NavDropdown({ group }: { group: NavGroup }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground inline-flex items-center gap-1 text-sm font-medium outline-none transition-colors">
        {group.label}
        <ChevronDown className="size-3.5 transition-transform duration-200 data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={10} className="w-72">
        {group.items.map((it) => {
          const Icon = it.icon;
          const inner = (
            <>
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm leading-tight font-medium">{it.title}</span>
                <span className="text-muted-foreground text-xs">{it.desc}</span>
              </span>
            </>
          );
          return (
            <DropdownMenuItem key={it.title} asChild className="gap-3 py-2">
              {it.href.startsWith("#") ? <a href={it.href}>{inner}</a> : <Link href={it.href}>{inner}</Link>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LandingContent({
  authed,
  username,
  engineVersion,
  live,
}: {
  authed: boolean;
  username: string | null;
  engineVersion: string | null;
  live: LiveStats;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const ctaHref = authed ? "/welcome" : "/login";
  const ctaLabel = authed ? "Open DEEPFLOW" : "Get started";
  const initials = (username ?? "").slice(0, 2).toUpperCase();

  const liveStats = [
    { value: live.definitions, label: "process definitions" },
    { value: live.instances, label: "running instances" },
    { value: live.tasks, label: "open tasks" },
    { value: live.decisions, label: "decision tables" },
    { value: live.deployments, label: "deployments" },
    { value: live.incidents, label: "open incidents" },
  ];

  return (
    <div className="bg-background text-foreground min-h-screen antialiased">
      {/* ═══════════ NAV ═══════════ */}
      <header className="bg-background/80 border-border sticky top-0 z-50 border-b backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 lg:px-10">
          <Link href="/landing" className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Workflow className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-[0.14em]">DEEPFLOW</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_GROUPS.map((g) => (
              <NavDropdown key={g.label} group={g} />
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
              {engineVersion ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Engine {engineVersion} online
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Engine unreachable
                </>
              )}
            </span>
            {authed ? (
              <>
                <Button size="sm" className="rounded-full" asChild>
                  <Link href="/welcome">Open DEEPFLOW</Link>
                </Button>
                <div
                  className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full text-sm font-semibold"
                  title={username ?? undefined}
                >
                  {initials}
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm" className="rounded-full" asChild>
                  <Link href="/login">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <button type="button" className="md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </nav>

        {mobileOpen && (
          <div className="border-border max-h-[70vh] overflow-y-auto border-t px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {NAV_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="text-muted-foreground mb-1 px-1 text-xs font-semibold tracking-wide uppercase">
                    {g.label}
                  </p>
                  <div className="flex flex-col">
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      const inner = (
                        <>
                          <Icon className="text-primary size-4 shrink-0" />
                          {it.title}
                        </>
                      );
                      const cls = "hover:bg-accent flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium";
                      return it.href.startsWith("#") ? (
                        <a key={it.title} href={it.href} onClick={() => setMobileOpen(false)} className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <Link key={it.title} href={it.href} onClick={() => setMobileOpen(false)} className={cls}>
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-border mt-4 flex flex-col gap-2 border-t pt-4">
              <Button className="rounded-full" asChild>
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
              {!authed && (
                <Button variant="outline" className="rounded-full" asChild>
                  <Link href="/login">Login</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden">
        <div className="bg-primary/10 pointer-events-none absolute -top-32 right-0 size-[560px] translate-x-1/3 rounded-full blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:px-10 lg:py-24">
          {/* Left — copy */}
          <div>
            <Reveal>
              <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium">
                <span className="bg-primary size-1.5 rounded-full" />
                The modern console for your Camunda 7 engine
              </span>
            </Reveal>

            <Reveal delay={50}>
              <h1 className="mt-6 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Orchestrating processes, <span className="text-primary">empowering people.</span>
              </h1>
            </Reveal>

            <Reveal delay={100}>
              <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
                DEEPFLOW is a fast, modern operations console for your BPMN & DMN engine — live dashboards, AI-written
                insights, a human tasklist and full administration, all in one place.
              </p>
            </Reveal>

            <Reveal delay={150}>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="rounded-full" asChild>
                  <Link href={ctaHref}>
                    {ctaLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full" asChild>
                  <a href="#modules">Explore modules</a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {CHIPS.map((c) => (
                  <span
                    key={c}
                    className="border-border bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  >
                    <span className="bg-primary/60 size-1.5 rounded-full" /> {c}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right — the living process */}
          <Reveal delay={100}>
            <HeroFlow />
          </Reveal>
        </div>

        {/* Live engine strip — real numbers, straight from engine-rest. */}
        <div className="bg-muted/40 border-border border-y">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-6 lg:flex-row lg:gap-10 lg:px-10">
            <span className="text-muted-foreground shrink-0 text-sm font-medium">Your engine, right now</span>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {liveStats.map((s) => (
                <span key={s.label} className="text-sm">
                  <span className="font-bold tracking-tight tabular-nums">{fmt(s.value)}</span>{" "}
                  <span className="text-muted-foreground/80 font-medium">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CHALLENGES ═══════════ */}
      <section className="bg-primary/5 border-border border-b">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Running an engine blind is expensive</h2>
            <p className="text-muted-foreground mt-3">
              The engine is rock-solid. The way teams watch and operate it usually isn't. These are the problems
              DEEPFLOW removes.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGES.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title} delay={(i % 4) * 60}>
                  <div className="border-border bg-card h-full rounded-2xl border p-6">
                    <span className="bg-primary/10 text-primary mb-4 flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-base font-semibold">{c.title}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{c.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW WE SOLVE (mock insight card + checklist) ═══════════ */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            {/* A stylized AI executive summary — the dashboard's signature element. */}
            <div className="border-border bg-card relative overflow-hidden rounded-3xl border p-6 shadow-xl sm:p-8">
              <div className="bg-primary/10 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl" />
              <div className="relative">
                <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
                  <Sparkles className="size-3" /> AI executive summary
                </span>
                <p className="mt-4 text-lg leading-relaxed font-medium">
                  “Order fulfillment is healthy: 38 instances in flight, median cycle time 2.1 days. One branch — manual
                  escalation — carries 4 of your 5 open incidents. Retrying the failed external task clears 3 of them.”
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Throughput up
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Escalation hotspot
                  </span>
                  <span className="bg-destructive/10 border-destructive/30 text-destructive rounded-full border px-2.5 py-1 text-xs font-medium">
                    5 incidents
                  </span>
                </div>
                <div className="border-border text-muted-foreground mt-6 flex items-center justify-between border-t pt-4 text-xs">
                  <span>Generated from live engine data</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    Open the dashboard <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5" /> How DEEPFLOW solves it
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">From raw engine to operating picture</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Diagrams, history and runtime stop being separate tabs and start telling one story — so operators spend
              less time hunting and more time deciding.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {SOLUTIONS.map((s) => (
                <div key={s} className="flex items-start gap-2.5">
                  <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
                  <span className="text-sm leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
            <Button size="lg" className="mt-7 rounded-full" asChild>
              <Link href={ctaHref}>
                {ctaLabel} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ RESULTS ═══════════ */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One console, the whole engine</h2>
            <p className="text-primary-foreground/80 mt-3">What changes when operations move onto DEEPFLOW.</p>
          </Reveal>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {RESULTS.map((r, i) => (
              <Reveal key={r.label} delay={(i % 4) * 60} className="text-center">
                <div className="text-4xl font-bold tracking-tight tabular-nums lg:text-5xl">{r.value}</div>
                <div className="text-primary-foreground/80 mt-2 text-sm font-medium">{r.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES ═══════════ */}
      <section id="modules" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything the engine can do, in one place</h2>
          <p className="text-muted-foreground mt-3">
            Nine connected modules covering the full process lifecycle — from deployment to decision, instance to
            authorization.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            return (
              <Reveal key={m.title} delay={(i % 3) * 60}>
                <Link href={m.href} className="group block h-full">
                  <div className="border-border bg-card hover:border-primary/50 hover:bg-accent/30 flex h-full flex-col rounded-xl border p-5 transition-colors">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                        <Icon className="size-5" />
                      </span>
                      {m.badge && (
                        <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold">{m.title}</h3>
                    <p className="text-muted-foreground mt-1.5 flex-1 text-sm leading-relaxed">{m.desc}</p>
                    <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
                      Open
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how" className="bg-muted/30 border-border border-y">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Process operations in 3 simple steps</h2>
            <p className="text-muted-foreground mt-3">One connected loop — every step feeds the next.</p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80}>
                <div className="border-border bg-card h-full rounded-2xl border p-6">
                  <div className="text-primary/30 mb-2 text-4xl font-bold tabular-nums">{step.n}</div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ENGINE-NATIVE ═══════════ */}
      <section id="engine" className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <ShieldCheck className="size-3.5" /> Engine-native
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Nothing bolted on — it speaks fluent engine-rest
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              DEEPFLOW sits directly on your engine's REST API. No sidecar database, no sync jobs, no migration — point
              it at an engine and every screen is live. Your authorizations still decide who sees what.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="rounded-full" asChild>
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/cockpit">See the dashboard</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="border-border bg-card grid gap-2 rounded-2xl border p-6 sm:grid-cols-2">
              {ENGINE_FACTS.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ TESTIMONIAL ═══════════ */}
      <section className="border-border bg-muted/30 border-t">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:py-24">
          <Reveal>
            <div className="mb-5 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="size-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
              &ldquo;We stopped tailing logs. The dashboard tells us what broke, and the AI tells us why it
              matters.&rdquo;
            </blockquote>
            <div className="mt-8 flex items-center justify-center gap-3">
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full text-sm font-bold">
                OPS
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold">A process operations team</p>
                <p className="text-muted-foreground text-xs">running their engine through DEEPFLOW</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <Reveal>
            <span className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
              <Workflow className="size-6" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Take command of your processes</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
              Dashboards, tasklist, decisions and administration — one fast console on top of the engine you already
              trust.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full" asChild>
                <Link href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full" asChild>
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-border border-t">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Link href="/landing" className="flex items-center gap-2.5">
                <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <Workflow className="size-4" />
                </span>
                <span className="text-base font-bold tracking-[0.14em]">DEEPFLOW</span>
              </Link>
              <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
                A modern operations console for BPMN & DMN engines — live monitoring, human tasks, AI insights and
                administration in one place.
              </p>
            </div>

            <div>
              <h5 className="text-sm font-semibold">Modules</h5>
              <div className="mt-3 flex flex-col gap-2">
                {MODULES.slice(0, 5).map((m) => (
                  <Link
                    key={m.title}
                    href={m.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold">Platform</h5>
              <div className="mt-3 flex flex-col gap-2">
                <a href="#how" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  How it works
                </a>
                <a href="#engine" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Engine-native
                </a>
                <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Login
                </Link>
                <Link href="/welcome" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                  Welcome tour
                </Link>
              </div>
            </div>
          </div>

          <div className="border-border text-muted-foreground mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs sm:flex-row">
            <p>&copy; 2026 DEEPFLOW. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <Workflow className="size-3.5" /> Runs on your Camunda 7 engine · engine-rest native
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
