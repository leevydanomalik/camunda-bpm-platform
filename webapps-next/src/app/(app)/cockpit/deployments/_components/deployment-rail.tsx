"use client";

import { useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CalendarClock, Inbox, Layers, Search, Upload } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DeploymentRow = {
  id: string;
  name: string | null;
  source: string | null;
  deploymentTime: string;
  tenantId: string | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function DeploymentRail({
  deployments,
  selectedId,
  error,
}: {
  deployments: DeploymentRow[] | null;
  selectedId: string | null;
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!deployments) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return deployments;
    return deployments.filter((d) => {
      return (
        (d.name ?? "").toLowerCase().includes(needle) ||
        (d.source ?? "").toLowerCase().includes(needle) ||
        d.id.toLowerCase().includes(needle)
      );
    });
  }, [deployments, q]);

  function selectDeployment(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("deploymentId", id);
    params.delete("resourceId");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 border-b px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Deployments</div>
            <div className="text-sm font-medium">
              {deployments !== null ? `${deployments.length} total` : "Loading…"}
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Deploy upload arrives in a later wave"
            className="text-muted-foreground/60 hover:bg-muted disabled:cursor-not-allowed inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs"
          >
            <Upload className="size-3.5" />
            Deploy
          </button>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, source, id…"
            className="h-9 pl-8 text-sm"
            disabled={!deployments}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Engine unreachable: {error}</div>
        ) : filtered === null ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Loading deployments…</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
              <Inbox className="size-5" />
            </div>
            <p className="text-sm font-medium">{deployments?.length ? "No matches" : "No deployments yet"}</p>
          </div>
        ) : (
          <ol className="divide-y">
            {filtered.map((d) => {
              const isActive = selectedId === d.id;
              const label = d.name?.trim() || d.id;
              return (
                <li key={d.id} className="relative">
                  {isActive ? <span className="bg-primary absolute inset-y-0 left-0 w-1" /> : null}
                  <button
                    type="button"
                    onClick={() => selectDeployment(d.id)}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition-colors",
                      isActive ? "bg-accent/60" : "hover:bg-accent/30",
                    )}
                  >
                    <div
                      className={cn(
                        "truncate text-sm leading-snug font-semibold",
                        isActive ? "text-primary" : "text-foreground",
                      )}
                      title={label}
                    >
                      {label}
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {formatDate(d.deploymentTime)}
                      </span>
                      {d.source ? (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="size-3" />
                          {d.source}
                        </span>
                      ) : null}
                      {d.tenantId ? (
                        <span className="border-border bg-background inline-flex items-center rounded border px-1.5 py-0">
                          {d.tenantId}
                        </span>
                      ) : null}
                    </div>
                    <code className="text-muted-foreground/70 mt-1 block truncate font-mono text-[10px]">{d.id}</code>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {deployments !== null && filtered !== null ? (
        <footer className="text-muted-foreground border-t px-4 py-2 text-[11px]">
          Showing {filtered.length} of {deployments.length}
        </footer>
      ) : null}
    </div>
  );
}
