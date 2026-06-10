"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { ArrowUpDown, Search, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DecisionDefinitionRow = {
  id: string;
  key: string;
  name: string | null;
  category: string | null;
  version: number;
  tenantId: string | null;
  versionTag: string | null;
  resource: string;
  decisionRequirementsDefinitionKey: string | null;
};

type SortKey = "name" | "key" | "drd" | "version";

export function DecisionsTable({ defs }: { defs: DecisionDefinitionRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = !needle
      ? defs
      : defs.filter(
          (d) =>
            (d.name ?? "").toLowerCase().includes(needle) ||
            d.key.toLowerCase().includes(needle) ||
            (d.decisionRequirementsDefinitionKey ?? "").toLowerCase().includes(needle) ||
            (d.tenantId ?? "").toLowerCase().includes(needle),
        );
    return [...base].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return dir * (a.name ?? a.key).localeCompare(b.name ?? b.key);
        case "key":
          return dir * a.key.localeCompare(b.key);
        case "drd":
          return (
            dir * (a.decisionRequirementsDefinitionKey ?? "").localeCompare(b.decisionRequirementsDefinitionKey ?? "")
          );
        case "version":
          return dir * (a.version - b.version);
      }
    });
  }, [defs, q, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, key, DRD…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          Showing {filtered.length} of {defs.length}
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
              <TableHead>
                <SortHeader label="Key" active={sort.key === "key"} dir={sort.dir} onClick={() => toggleSort("key")} />
              </TableHead>
              <TableHead>
                <SortHeader label="DRD" active={sort.key === "drd"} dir={sort.dir} onClick={() => toggleSort("drd")} />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                  No matches.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id} className="hover:bg-accent/40">
                  <TableCell className="font-medium">
                    <Link
                      href={`/cockpit/decisions/${encodeURIComponent(d.key)}`}
                      className="text-foreground hover:text-primary inline-flex items-center gap-1.5"
                    >
                      <Table2 className="text-muted-foreground size-3.5" />
                      {d.name ?? d.key}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{d.key}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {d.decisionRequirementsDefinitionKey ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.version}
                    {d.versionTag ? (
                      <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] font-normal">
                        {d.versionTag}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{d.tenantId ?? "—"}</TableCell>
                </TableRow>
              ))
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
