"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bell, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type TaskNotification = {
  id: string;
  name: string;
  created: string;
  processKey: string | null;
};

const POLL_MS = 15_000;
const SEEN_CAP = 300;

function seenKey(username: string) {
  return `deepflow.bell.seen.${username}`;
}

function loadSeen(username: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(seenKey(username));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistSeen(username: string, seen: Set<string>) {
  // Cap so the entry can't grow unbounded over months of tasks.
  window.localStorage.setItem(seenKey(username), JSON.stringify([...seen].slice(-SEEN_CAP)));
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Live task-notification bell. Polls the engine (via /api/tasks/notifications)
 * for tasks assigned to the signed-in user; tasks created after the stored
 * last-seen mark count as unread. Brand-new arrivals (created while the app is
 * open) additionally fire a toast so you notice without opening the popover.
 */
export function HeaderBell({ username }: { username: string }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskNotification[]>([]);
  // Per-task read state, persisted per user. The list shows only unread tasks
  // and the badge is exactly the list length.
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen(username));
  const [open, setOpen] = useState(false);
  // Task ids seen by a previous poll — anything new after the first poll toasts.
  const knownIds = useRef<Set<string> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { tasks?: TaskNotification[] };
      const next = data.tasks ?? [];
      setTasks(next);

      if (knownIds.current === null) {
        // First poll after mount: baseline only — never toast a backlog.
        knownIds.current = new Set(next.map((t) => t.id));
        return;
      }
      const fresh = next.filter((t) => !knownIds.current?.has(t.id));
      for (const t of next) knownIds.current.add(t.id);
      for (const t of fresh) {
        toast.info(`New task assigned: ${t.name}`, {
          description: t.processKey ?? undefined,
          action: { label: "Open", onClick: () => router.push(`/tasklist/${encodeURIComponent(t.id)}`) },
        });
      }
    } catch {
      // engine briefly unreachable — keep the previous list
    }
  }, [router]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  // The list IS the unread set — read items drop out, badge = list length.
  const unread = tasks.filter((t) => !seen.has(t.id));

  function markRead(ids: string[]) {
    setSeen((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      persistSeen(username, next);
      return next;
    });
  }

  // Items are dismissed only when opened — merely closing the popover keeps
  // the rest unread, so the badge keeps counting what's still in the list.

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label={`Notifications${unread.length > 0 ? `, ${unread.length} unread` : ""}`}
        >
          <Bell className="size-4" />
          {unread.length > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">My tasks</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {unread.length > 0 ? `${unread.length} new` : "up to date"}
          </span>
        </div>
        {unread.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-1.5 px-3 py-8 text-center text-xs">
            <ClipboardList className="size-5 opacity-40" />
            You're all caught up.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {unread.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasklist/${encodeURIComponent(t.id)}`}
                  onClick={() => {
                    markRead([t.id]);
                    setOpen(false);
                  }}
                  className="hover:bg-accent flex items-start gap-2.5 px-3 py-2"
                >
                  <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.name}</span>
                    <span className="text-muted-foreground block text-[11px]">
                      {t.processKey ? `${t.processKey} · ` : ""}
                      {relative(t.created)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
