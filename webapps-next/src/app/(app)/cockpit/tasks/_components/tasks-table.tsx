"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowUpDown, Filter, Search, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CockpitTask = {
  id: string;
  name: string | null;
  assignee: string | null;
  created: string;
  due: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  taskDefinitionKey: string | null;
};

type SortKey = "name" | "created" | "due" | "priority";
type AssigneeFilter = "all" | "assigned" | "unassigned";

function processKey(id: string | null): string | null {
  if (!id) return null;
  return id.split(":")[0] ?? id;
}

function relative(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const future = ms > 0;
  const absDays = Math.abs(ms) / 86_400_000;
  if (absDays < 1) {
    const h = Math.max(1, Math.round(Math.abs(ms) / 3_600_000));
    return future ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.round(absDays);
  return future ? `in ${d}d` : `${d}d ago`;
}

export function CockpitTasksTable({ tasks }: { tasks: CockpitTask[] }) {
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "created",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = tasks.filter((t) => {
      if (assignee === "assigned" && !t.assignee) return false;
      if (assignee === "unassigned" && t.assignee) return false;
      if (!needle) return true;
      return (
        (t.name ?? "").toLowerCase().includes(needle) ||
        (t.assignee ?? "").toLowerCase().includes(needle) ||
        (t.processDefinitionId ?? "").toLowerCase().includes(needle)
      );
    });
    return [...base].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return dir * (a.name ?? "").localeCompare(b.name ?? "");
        case "created":
          return dir * (new Date(a.created).getTime() - new Date(b.created).getTime());
        case "due": {
          const ad = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;
          return dir * (ad - bd);
        }
        case "priority":
          return dir * (a.priority - b.priority);
      }
    });
  }, [tasks, q, sort, assignee]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, assignee, process…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="bg-muted text-muted-foreground inline-flex items-center rounded-md p-0.5 text-xs">
          {(["all", "assigned", "unassigned"] as AssigneeFilter[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAssignee(mode)}
              className={cn(
                "rounded-sm px-2.5 py-1 capitalize",
                assignee === mode ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          Showing {filtered.length} of {tasks.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>
                <SortHeader
                  label="Name"
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("name")}
                />
              </TableHead>
              <TableHead>Process</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>
                <SortHeader
                  label="Created"
                  active={sort.key === "created"}
                  dir={sort.dir}
                  onClick={() => toggleSort("created")}
                />
              </TableHead>
              <TableHead>
                <SortHeader label="Due" active={sort.key === "due"} dir={sort.dir} onClick={() => toggleSort("due")} />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Priority"
                  align="right"
                  active={sort.key === "priority"}
                  dir={sort.dir}
                  onClick={() => toggleSort("priority")}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  <Filter className="mr-1 inline size-3.5" /> No tasks match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const pKey = processKey(t.processDefinitionId);
                const overdue = t.due ? new Date(t.due) < new Date() : false;
                return (
                  <TableRow key={t.id} className="hover:bg-accent/40">
                    <TableCell className="font-medium">
                      <Link href={`/tasklist/${encodeURIComponent(t.id)}`} className="hover:text-primary">
                        {t.name ?? t.taskDefinitionKey ?? t.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {pKey ? (
                        <Link
                          href={`/cockpit/processes/${encodeURIComponent(pKey)}${t.processInstanceId ? `/instances/${encodeURIComponent(t.processInstanceId)}` : ""}`}
                          className="text-muted-foreground hover:text-foreground font-mono"
                        >
                          {pKey}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.assignee ? (
                        <span className="text-foreground inline-flex items-center gap-1">
                          <User className="text-muted-foreground size-3" />
                          {t.assignee}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/80 italic">unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {relative(t.created)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-xs whitespace-nowrap",
                        overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                      )}
                    >
                      {relative(t.due)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-6 items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold",
                          t.priority >= 75
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                            : t.priority >= 50
                              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {t.priority}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:text-foreground inline-flex items-center gap-1 text-xs font-medium",
        align === "right" ? "justify-end" : "justify-start",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 transition-opacity",
          active ? "opacity-100" : "opacity-30",
          active && dir === "asc" ? "rotate-180" : "",
        )}
      />
    </button>
  );
}
