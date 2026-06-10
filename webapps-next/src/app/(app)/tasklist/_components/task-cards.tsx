"use client";

import { useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { ArrowDownNarrowWide, Bell, Bookmark, Inbox, Search, User } from "lucide-react";

import { StartProcessButton } from "@/components/start-process-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ListTask = {
  id: string;
  name: string;
  assignee: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
};

function relative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function processName(id: string | null): string | null {
  if (!id) return null;
  return id.split(":")[0] ?? id;
}

// Same palette as the dashboard's Active users card — tone picked by a stable
// hash of the username so each person keeps their color everywhere.
const AVATAR_TONES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

function Assignee({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="text-muted-foreground/80 inline-flex shrink-0 items-center gap-1.5">
        <span className="border-muted-foreground/40 flex size-5 items-center justify-center rounded-full border border-dashed">
          <User className="size-2.5" />
        </span>
        unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[9px] font-semibold uppercase",
          avatarTone(name),
        )}
      >
        {name.slice(0, 2)}
      </span>
      <span className="text-foreground/80">{name}</span>
    </span>
  );
}

/**
 * Engine task priority (0–100, default 50). The default carries no signal, so
 * only deviations get a chip: ≥75 high (red), >50 elevated (amber), <50 low.
 */
function PriorityChip({ priority }: { priority: number }) {
  if (priority === 50) return null;
  return (
    <span
      title={`Priority ${priority} (default is 50)`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
        priority >= 75
          ? "bg-red-500/12 text-red-600 ring-red-500/20 dark:text-red-400"
          : priority > 50
            ? "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-400"
            : "bg-muted text-muted-foreground ring-border",
      )}
    >
      P{priority}
    </span>
  );
}

export function TaskCards({
  tasks,
  selectedId,
  error,
}: {
  tasks: ListTask[] | null;
  selectedId: string | null;
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!tasks) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((t) => {
      const name = (t.name ?? "").toLowerCase();
      const assignee = (t.assignee ?? "").toLowerCase();
      const pdef = (t.processDefinitionId ?? "").toLowerCase();
      return name.includes(needle) || assignee.includes(needle) || pdef.includes(needle);
    });
  }, [tasks, q]);

  function selectTask(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 border-b px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled
            title="Sort options arrive in a later wave"
            className="text-foreground/80 hover:text-foreground disabled:text-muted-foreground/70 inline-flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed"
          >
            <ArrowDownNarrowWide className="size-3.5" />
            Created
          </button>
          <StartProcessButton variant="ghost" size="sm" className="h-7 px-2 text-xs" />
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for tasks…"
            className="h-9 pl-8 text-sm"
            disabled={!tasks}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Engine unreachable: {error}</div>
        ) : filtered === null ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Loading tasks…</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
              <Inbox className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{tasks?.length ? "No matches" : "Inbox zero"}</p>
              <p className="text-muted-foreground text-xs">
                {tasks?.length
                  ? "Adjust the search or pick a different view."
                  : "Nothing waiting for action in this view."}
              </p>
            </div>
          </div>
        ) : (
          <ol className="divide-y">
            {filtered.map((t) => {
              const isActive = selectedId === t.id;
              const overdue = t.due ? new Date(t.due) < new Date() : false;
              const proc = processName(t.processDefinitionId);
              return (
                <li key={t.id} className="relative">
                  {isActive ? <span className="bg-primary absolute inset-y-0 left-0 w-1" /> : null}
                  <button
                    type="button"
                    onClick={() => selectTask(t.id)}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition-colors",
                      isActive ? "bg-accent/60" : "hover:bg-accent/30",
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={cn(
                            "truncate text-sm leading-snug font-semibold",
                            isActive ? "text-primary" : "text-foreground",
                          )}
                        >
                          {t.name || t.id}
                        </div>
                        <PriorityChip priority={t.priority} />
                      </div>
                      {proc ? <div className="text-muted-foreground truncate text-[12px] italic">{proc}</div> : null}
                    </div>
                    <div className="text-muted-foreground mt-2 flex items-center justify-between gap-3 text-[11px]">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="size-3" />
                          {relative(t.created)}
                        </span>
                        {t.due ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              overdue && "text-red-600 dark:text-red-400",
                            )}
                          >
                            <Bell className="size-3" />
                            {relative(t.due)}
                          </span>
                        ) : null}
                      </div>
                      <Assignee name={t.assignee} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {tasks !== null && filtered !== null ? (
        <footer className="text-muted-foreground border-t px-4 py-2 text-[11px]">
          Showing {filtered.length} of {tasks.length}
        </footer>
      ) : null}
    </div>
  );
}
