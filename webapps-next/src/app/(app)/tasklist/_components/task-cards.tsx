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
                      "block w-full px-4 py-3 pr-12 text-left transition-colors",
                      isActive ? "bg-accent/60" : "hover:bg-accent/30",
                    )}
                  >
                    <div className="space-y-0.5">
                      <div
                        className={cn(
                          "truncate text-sm leading-snug font-semibold",
                          isActive ? "text-primary" : "text-foreground",
                        )}
                      >
                        {t.name || t.id}
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
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <User className="size-3" />
                        {t.assignee ? t.assignee : <em className="text-muted-foreground/80 not-italic">unassigned</em>}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "absolute top-2.5 right-3 text-base font-semibold tabular-nums",
                        t.priority >= 75
                          ? "text-red-600 dark:text-red-400"
                          : t.priority >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                      )}
                      title={`Priority ${t.priority}`}
                    >
                      {t.priority}
                    </span>
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
