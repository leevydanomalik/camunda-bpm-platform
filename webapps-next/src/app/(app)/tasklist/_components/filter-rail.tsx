"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterMode = "mine" | "claimable" | "all";

type QuickFilter = {
  id: FilterMode;
  label: string;
  accent: string;
};

const QUICK_FILTERS: QuickFilter[] = [
  { id: "mine", label: "My Tasks", accent: "var(--primary)" },
  { id: "claimable", label: "My Group Tasks", accent: "#f59e0b" },
  { id: "all", label: "All Tasks", accent: "#10b981" },
];

export function FilterRail({ active, count }: { active: FilterMode; count: number | null }) {
  const searchParams = useSearchParams();

  function hrefFor(id: FilterMode): string {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "mine") {
      params.delete("filter");
    } else {
      params.set("filter", id);
    }
    params.delete("taskId");
    const qs = params.toString();
    return qs ? `/tasklist?${qs}` : "/tasklist";
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2.5">
        <button
          type="button"
          disabled
          title="Saved filter creation arrives in a later wave"
          className="text-primary/80 hover:text-primary disabled:text-muted-foreground/50 inline-flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed"
        >
          <Plus className="size-3.5" />
          Create a filter
        </button>
      </header>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-2">
          {QUICK_FILTERS.map((f) => {
            const isActive = active === f.id;
            return (
              <li key={f.id}>
                <Link
                  href={hrefFor(f.id)}
                  className={cn(
                    "group relative flex h-16 items-center justify-center overflow-hidden rounded-md border px-3 text-sm transition-all",
                    isActive
                      ? "bg-card text-foreground border-border font-medium shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-1 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                    )}
                    style={{ backgroundColor: f.accent }}
                  />
                  <span className="text-center">{f.label}</span>
                  {isActive && count !== null ? (
                    <span className="text-foreground/90 absolute top-1.5 right-2 text-xs font-semibold tabular-nums">
                      {count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="text-muted-foreground mt-6 px-1 text-[10px] font-semibold tracking-wider uppercase">
          Saved filters
        </div>
        <div className="mt-2 rounded-md border border-dashed px-3 py-4 text-center">
          <p className="text-muted-foreground text-xs">No saved filters yet</p>
          <p className="text-muted-foreground/70 mt-1 text-[11px] leading-snug">
            Engine-stored filters arrive in a later wave.
          </p>
        </div>
      </nav>
    </div>
  );
}
