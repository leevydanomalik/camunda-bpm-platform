"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Notification bell placeholder. Live wiring (engine incidents, failed jobs,
 * stale tasks) arrives in a later wave; for now we display a static count
 * that mirrors the visual treatment used in the rest of the app shell.
 */
export function HeaderBell({ count = 0 }: { count?: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-8"
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      disabled
    >
      <Bell className="size-4" />
      {count > 0 ? (
        <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}
