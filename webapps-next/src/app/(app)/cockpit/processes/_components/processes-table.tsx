"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { AlertTriangle, ArrowUpDown, Pause, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ProcessDefinitionStat = {
  id: string;
  instances: number;
  failedJobs: number;
  incidents?: Array<{ incidentType: string; incidentCount: number }>;
  definition: {
    id: string;
    key: string;
    name: string | null;
    version: number;
    tenantId: string | null;
    versionTag: string | null;
    suspended: boolean;
  };
};

type SortKey = "name" | "key" | "version" | "instances" | "incidents";

function incidentCount(s: ProcessDefinitionStat): number {
  return s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0;
}

export function ProcessesTable({
  stats,
  toolbar,
}: {
  stats: ProcessDefinitionStat[];
  /** Right-aligned controls in the search row (e.g. the table/cards toggle). */
  toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "instances",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = !needle
      ? stats
      : stats.filter((s) => {
          const d = s.definition;
          return (
            (d.name ?? "").toLowerCase().includes(needle) ||
            d.key.toLowerCase().includes(needle) ||
            (d.tenantId ?? "").toLowerCase().includes(needle) ||
            (d.versionTag ?? "").toLowerCase().includes(needle)
          );
        });
    const sorted = [...base].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return dir * (a.definition.name ?? a.definition.key).localeCompare(b.definition.name ?? b.definition.key);
        case "key":
          return dir * a.definition.key.localeCompare(b.definition.key);
        case "version":
          return dir * (a.definition.version - b.definition.version);
        case "instances":
          return dir * (a.instances - b.instances);
        case "incidents":
          return dir * (incidentCount(a) - incidentCount(b));
      }
    });
    return sorted;
  }, [stats, q, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

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
              <TableHead>
                <SortHeader label="Key" active={sort.key === "key"} dir={sort.dir} onClick={() => toggleSort("key")} />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Version"
                  align="right"
                  active={sort.key === "version"}
                  dir={sort.dir}
                  onClick={() => toggleSort("version")}
                />
              </TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Running"
                  align="right"
                  active={sort.key === "instances"}
                  dir={sort.dir}
                  onClick={() => toggleSort("instances")}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Incidents"
                  align="right"
                  active={sort.key === "incidents"}
                  dir={sort.dir}
                  onClick={() => toggleSort("incidents")}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  No matches.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const inc = incidentCount(s);
                const d = s.definition;
                return (
                  <TableRow key={s.id} className="hover:bg-accent/40">
                    <TableCell className="font-medium">
                      <Link
                        href={`/cockpit/processes/${encodeURIComponent(d.key)}`}
                        className="text-foreground hover:text-primary inline-flex items-center gap-1.5"
                      >
                        {d.suspended ? <Pause className="text-muted-foreground size-3.5" /> : null}
                        {d.name ?? d.key}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{d.key}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="text-foreground">{d.version}</span>
                      {d.versionTag ? (
                        <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] font-normal">
                          {d.versionTag}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{d.tenantId ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.instances}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {inc > 0 ? (
                        <span className="text-destructive inline-flex items-center justify-end gap-1 font-medium">
                          <AlertTriangle className="size-3.5" /> {inc}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
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
