import Link from "next/link";

import { Activity, CheckCircle2, History } from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";
import { cn } from "@/lib/utils";

import {
  type HistoricBatch,
  HistoricBatchesTable,
  type RunningBatch,
  RunningBatchesTable,
} from "./_components/batches-table";

type View = "running" | "history";

async function loadRunning(): Promise<{ rows: RunningBatch[]; error: string | null }> {
  try {
    const rows = await engineGet<RunningBatch[]>("/batch/statistics?sortBy=startTime&sortOrder=desc&maxResults=200");
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Failed to load batches" };
  }
}

async function loadHistory(): Promise<{ rows: HistoricBatch[]; error: string | null }> {
  try {
    const rows = await engineGet<HistoricBatch[]>("/history/batch?sortBy=startTime&sortOrder=desc&maxResults=200");
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Failed to load history" };
  }
}

export default async function BatchesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: View = rawView === "history" ? "history" : "running";

  const [running, history] = await Promise.all([loadRunning(), loadHistory()]);

  const totalFailed = running.rows.reduce((a, b) => a + b.failedJobs, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
        <p className="text-muted-foreground text-sm">
          Long-running bulk operations (migration, modification, set-variables, delete, …).
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Activity className="text-muted-foreground size-4" />}
          label="Running"
          value={running.rows.length}
        />
        <StatTile
          icon={<CheckCircle2 className="text-muted-foreground size-4" />}
          label="In history"
          value={history.rows.length}
        />
        <StatTile
          icon={<Activity className="text-muted-foreground size-4" />}
          label="Failed jobs in running"
          value={totalFailed}
          tone={totalFailed > 0 ? "warning" : "default"}
        />
      </div>

      <div className="bg-muted text-muted-foreground inline-flex items-center rounded-md p-0.5 text-xs">
        <TabLink view="running" current={view} count={running.rows.length}>
          <Activity className="size-3.5" /> Running
        </TabLink>
        <TabLink view="history" current={view} count={history.rows.length}>
          <History className="size-3.5" /> History
        </TabLink>
      </div>

      {view === "running" ? (
        running.error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
            Failed to load: {running.error}
          </div>
        ) : running.rows.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
            No running batches.
          </div>
        ) : (
          <RunningBatchesTable batches={running.rows} />
        )
      ) : history.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          Failed to load: {history.error}
        </div>
      ) : history.rows.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No historic batches.
        </div>
      ) : (
        <HistoricBatchesTable batches={history.rows} />
      )}
    </div>
  );
}

function TabLink({
  view,
  current,
  count,
  children,
}: {
  view: View;
  current: View;
  count: number;
  children: React.ReactNode;
}) {
  const isActive = current === view;
  return (
    <Link
      href={view === "running" ? "/cockpit/batches" : `/cockpit/batches?view=${view}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1",
        isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
      )}
    >
      {children}
      <span className="text-muted-foreground/80 ml-1 text-[10px] tabular-nums">{count}</span>
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
