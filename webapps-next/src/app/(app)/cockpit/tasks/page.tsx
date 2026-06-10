import { ClipboardList, User, UserMinus } from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";

import { type CockpitTask, CockpitTasksTable } from "./_components/tasks-table";

async function loadTasks(): Promise<{
  tasks: CockpitTask[];
  total: number | null;
  error: string | null;
}> {
  try {
    const [tasks, count] = await Promise.all([
      engineGet<CockpitTask[]>("/task?sortBy=created&sortOrder=desc&maxResults=200"),
      engineGet<{ count: number }>("/task/count").catch(() => null),
    ]);
    return { tasks, total: count?.count ?? null, error: null };
  } catch (err) {
    return { tasks: [], total: null, error: err instanceof Error ? err.message : "Failed to load tasks" };
  }
}

export default async function CockpitTasksPage() {
  const { tasks, total, error } = await loadTasks();

  const assigned = tasks.filter((t) => t.assignee).length;
  const unassigned = tasks.filter((t) => !t.assignee).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground text-sm">
          All open user tasks across every process instance — admin view, separate from your personal{" "}
          <span className="font-mono text-xs">/tasklist</span> inbox.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<ClipboardList className="text-muted-foreground size-4" />}
          label="Open tasks (engine total)"
          value={total ?? tasks.length}
        />
        <StatTile icon={<User className="text-muted-foreground size-4" />} label="Assigned" value={assigned} />
        <StatTile icon={<UserMinus className="text-muted-foreground size-4" />} label="Unassigned" value={unassigned} />
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          Failed to load: {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No open user tasks.
        </div>
      ) : (
        <>
          <CockpitTasksTable tasks={tasks} />
          {total !== null && tasks.length < total ? (
            <p className="text-muted-foreground text-center text-[11px]">
              Showing the {tasks.length} newest of {total} total — pagination arrives in a later wave.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card flex items-center justify-between rounded-md border px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat().format(value)}</div>
      </div>
      <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">{icon}</div>
    </div>
  );
}
