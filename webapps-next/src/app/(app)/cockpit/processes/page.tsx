import Link from "next/link";

import { AlertTriangle, GitBranch, LayoutGrid, List, Play } from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";
import { cn } from "@/lib/utils";

import { ProcessesCards } from "./_components/processes-cards";
import { type ProcessDefinitionStat, ProcessesTable } from "./_components/processes-table";

type View = "table" | "cards";

async function loadStatistics(): Promise<{ stats: ProcessDefinitionStat[]; error: string | null }> {
  try {
    const stats = await engineGet<ProcessDefinitionStat[]>("/process-definition/statistics?incidents=true");
    return { stats, error: null };
  } catch (err) {
    return {
      stats: [],
      error: err instanceof Error ? err.message : "Failed to load process definitions",
    };
  }
}

async function loadXml(id: string): Promise<string | null> {
  try {
    const r = await engineGet<{ id: string; bpmn20Xml: string }>(`/process-definition/${encodeURIComponent(id)}/xml`);
    return r.bpmn20Xml ?? null;
  } catch {
    return null;
  }
}

async function loadXmls(ids: string[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await loadXml(id)] as const));
  return Object.fromEntries(entries);
}

export default async function ProcessesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: View = rawView === "cards" ? "cards" : "table";

  const { stats, error } = await loadStatistics();

  const totalInstances = stats.reduce((a, s) => a + s.instances, 0);
  const totalIncidents = stats.reduce((a, s) => a + (s.incidents?.reduce((x, y) => x + y.incidentCount, 0) ?? 0), 0);

  // Cards mode pulls all XMLs in parallel for the thumbnails. Fine for <~50
  // definitions; if this grows beyond that, switch to client-side lazy loading
  // via IntersectionObserver.
  const xmls = view === "cards" ? await loadXmls(stats.map((s) => s.id)) : {};

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Processes</h1>
        <p className="text-muted-foreground text-sm">All deployed process definitions (latest version, active).</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<GitBranch className="text-muted-foreground size-4" />}
          label="Definitions"
          value={stats.length}
        />
        <StatTile
          icon={<Play className="text-muted-foreground size-4" />}
          label="Running instances"
          value={totalInstances}
        />
        <StatTile
          icon={<AlertTriangle className="text-muted-foreground size-4" />}
          label="Open incidents"
          value={totalIncidents}
          tone={totalIncidents > 0 ? "warning" : "default"}
        />
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          Failed to load: {error}
        </div>
      ) : stats.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No process definitions deployed yet.
        </div>
      ) : view === "cards" ? (
        <ProcessesCards stats={stats} xmls={xmls} toolbar={<ViewToggle current={view} />} />
      ) : (
        <ProcessesTable stats={stats} toolbar={<ViewToggle current={view} />} />
      )}
    </div>
  );
}

function ViewToggle({ current }: { current: View }) {
  return (
    <div className="bg-muted text-muted-foreground inline-flex items-center rounded-md p-0.5 text-xs">
      <ViewLink view="table" current={current}>
        <List className="size-3.5" /> Table
      </ViewLink>
      <ViewLink view="cards" current={current}>
        <LayoutGrid className="size-3.5" /> Cards
      </ViewLink>
    </div>
  );
}

function ViewLink({ view, current, children }: { view: View; current: View; children: React.ReactNode }) {
  const isActive = current === view;
  return (
    <Link
      href={view === "table" ? "/cockpit/processes" : `/cockpit/processes?view=${view}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1",
        isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="bg-card flex items-center justify-between rounded-md border px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "warning" && value > 0 ? "text-destructive" : "",
          )}
        >
          {new Intl.NumberFormat().format(value)}
        </div>
      </div>
      <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">{icon}</div>
    </div>
  );
}
