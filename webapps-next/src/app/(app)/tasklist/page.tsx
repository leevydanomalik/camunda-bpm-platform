import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

import { type FilterMode, FilterRail } from "./_components/filter-rail";
import { type ListTask, TaskCards } from "./_components/task-cards";
import { TaskDetailEmptyState, TaskDetailPane } from "./_components/task-detail-pane";
import { TasklistWorkspace } from "./_components/workspace";

function buildQuery(filter: FilterMode, username: string): string {
  const base = "sortBy=created&sortOrder=desc&maxResults=100";
  switch (filter) {
    case "mine":
      return `assignee=${encodeURIComponent(username)}&${base}`;
    case "claimable":
      return `candidateUser=${encodeURIComponent(username)}&${base}`;
    case "all":
      return base;
  }
}

async function safeTasks(
  filter: FilterMode,
  username: string,
): Promise<{ tasks: ListTask[] | null; error: string | null }> {
  try {
    const tasks = await engineGet<ListTask[]>(`/task?${buildQuery(filter, username)}`);
    return { tasks, error: null };
  } catch (err) {
    return {
      tasks: null,
      error: err instanceof Error ? err.message : "Engine unreachable",
    };
  }
}

function normalizeFilter(raw: string | undefined): FilterMode {
  return raw === "claimable" || raw === "all" ? raw : "mine";
}

export default async function TasklistPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; taskId?: string }>;
}) {
  const session = await getSession();
  const username = session?.username ?? "guest";
  const { filter: rawFilter, taskId: rawTaskId } = await searchParams;
  const filter = normalizeFilter(rawFilter);
  const selectedId = rawTaskId?.trim() ? rawTaskId : null;

  const { tasks, error } = await safeTasks(filter, username);

  return (
    <div className="h-[calc(100svh-5rem)] md:h-[calc(100svh-6rem)]">
      <TasklistWorkspace
        filterSlot={<FilterRail active={filter} count={tasks ? tasks.length : null} />}
        listSlot={<TaskCards tasks={tasks} selectedId={selectedId} error={error} />}
        detailSlot={selectedId ? <TaskDetailPane taskId={selectedId} username={username} /> : <TaskDetailEmptyState />}
      />
    </div>
  );
}
