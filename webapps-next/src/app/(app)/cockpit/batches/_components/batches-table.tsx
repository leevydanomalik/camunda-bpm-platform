"use client";

import { useMemo, useState } from "react";

import { Pause, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RunningBatch = {
  id: string;
  type: string;
  totalJobs: number;
  jobsCreated: number;
  remainingJobs: number;
  completedJobs: number;
  failedJobs: number;
  tenantId: string | null;
  createUserId: string | null;
  startTime?: string | null;
  executionStartTime?: string | null;
  suspended: boolean;
};

export type HistoricBatch = {
  id: string;
  type: string;
  totalJobs: number;
  batchJobsPerSeed: number;
  invocationsPerBatchJob: number;
  tenantId: string | null;
  createUserId: string | null;
  startTime: string | null;
  endTime: string | null;
};

function progressPct(b: RunningBatch): number {
  if (b.totalJobs === 0) return 0;
  return Math.round(((b.completedJobs + b.failedJobs) / b.totalJobs) * 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function useFilter<T extends { id: string; type: string; tenantId: string | null }>(rows: T[]) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.type.toLowerCase().includes(needle) ||
        (r.tenantId ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);
  return { q, setQ, filtered };
}

export function RunningBatchesTable({ batches }: { batches: RunningBatch[] }) {
  const { q, setQ, filtered } = useFilter(batches);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id, type, tenant…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          Showing {filtered.length} of {batches.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Type</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Done</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="w-64">Progress</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                  No running batches.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => {
                const pct = progressPct(b);
                return (
                  <TableRow key={b.id} className="hover:bg-accent/40">
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        {b.suspended ? <Pause className="text-muted-foreground size-3.5" /> : null}
                        {b.type}
                      </span>
                      {b.suspended ? (
                        <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px] font-normal">
                          suspended
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{b.id}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.totalJobs}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.completedJobs}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.failedJobs > 0 ? (
                        <span className="text-destructive font-medium">{b.failedJobs}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2" />
                        <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(b.startTime)}
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

export function HistoricBatchesTable({ batches }: { batches: HistoricBatch[] }) {
  const { q, setQ, filtered } = useFilter(batches);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id, type, tenant…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          Showing {filtered.length} of {batches.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Type</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Ended</TableHead>
              <TableHead>Started by</TableHead>
              <TableHead>Tenant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                  No historic batches.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id} className="hover:bg-accent/40">
                  <TableCell className="text-sm font-medium">{b.type}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{b.id}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.totalJobs}</TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(b.startTime)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(b.endTime)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{b.createUserId ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{b.tenantId ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
