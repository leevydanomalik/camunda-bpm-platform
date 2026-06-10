"use client";

import { useMemo, useState } from "react";

import dynamic from "next/dynamic";
import Link from "next/link";

import { AlertTriangle, Pause, Play, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ProcessDefinitionStat } from "./processes-table";

const BpmnThumbnail = dynamic(() => import("@/components/bpmn-viewer").then((m) => m.BpmnViewer), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/30 text-muted-foreground/60 flex h-full items-center justify-center text-[10px]">
      Loading…
    </div>
  ),
});

export type ProcessesCardsProps = {
  stats: ProcessDefinitionStat[];
  /** Map of definition id → BPMN XML (server-fetched in parallel). */
  xmls: Record<string, string | null>;
  /** Right-aligned controls in the search row (e.g. the table/cards toggle). */
  toolbar?: React.ReactNode;
};

function incidentCount(s: ProcessDefinitionStat): number {
  return s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0;
}

export function ProcessesCards({ stats, xmls, toolbar }: ProcessesCardsProps) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stats;
    return stats.filter((s) => {
      const d = s.definition;
      return (
        (d.name ?? "").toLowerCase().includes(needle) ||
        d.key.toLowerCase().includes(needle) ||
        (d.tenantId ?? "").toLowerCase().includes(needle) ||
        (d.versionTag ?? "").toLowerCase().includes(needle)
      );
    });
  }, [stats, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, key, tenant…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          Showing {filtered.length} of {stats.length}
        </span>
        {toolbar ? <div className="ml-auto">{toolbar}</div> : null}
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">No matches.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((s) => {
            const d = s.definition;
            const inc = incidentCount(s);
            const xml = xmls[s.id] ?? null;
            return (
              <Link
                key={s.id}
                href={`/cockpit/processes/${encodeURIComponent(d.key)}`}
                className="group bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-lg border shadow-sm transition-colors"
              >
                <div className="bg-muted/20 relative h-40 border-b">
                  {xml ? (
                    <BpmnThumbnail xml={xml} height={160} controls={false} />
                  ) : (
                    <div className="text-muted-foreground/60 flex h-full items-center justify-center text-xs">
                      Diagram unavailable
                    </div>
                  )}
                  {d.suspended ? (
                    <span className="bg-background/90 absolute top-2 left-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]">
                      <Pause className="size-3" /> Suspended
                    </span>
                  ) : null}
                  {inc > 0 ? (
                    <span className="border-destructive/30 bg-destructive/10 text-destructive absolute top-2 right-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium">
                      <AlertTriangle className="size-3" /> {inc}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 px-3 py-3">
                  <div>
                    <div
                      className="group-hover:text-primary truncate text-sm font-semibold transition-colors"
                      title={d.name ?? d.key}
                    >
                      {d.name ?? d.key}
                    </div>
                    <div className="text-muted-foreground truncate font-mono text-[11px]">{d.key}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        v{d.version}
                      </Badge>
                      {d.versionTag ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                          {d.versionTag}
                        </Badge>
                      ) : null}
                      {d.tenantId ? (
                        <span className="text-muted-foreground border-border rounded border px-1.5 text-[10px]">
                          {d.tenantId}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                        s.instances > 0 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Play className="size-3" />
                      {s.instances}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
