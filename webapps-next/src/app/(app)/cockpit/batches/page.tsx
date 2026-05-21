import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Batch = {
  id: string;
  type: string;
  totalJobs: number;
  jobsCreated: number;
  batchJobsPerSeed: number;
  invocationsPerBatchJob: number;
  seedJobDefinitionId: string;
  monitorJobDefinitionId: string;
  batchJobDefinitionId: string;
  tenantId: string | null;
  createUserId: string | null;
  startTime?: string | null;
  executionStartTime?: string | null;
  suspended: boolean;
};

type BatchStatistic = Batch & {
  remainingJobs: number;
  completedJobs: number;
  failedJobs: number;
};

async function loadBatches(): Promise<{ stats: BatchStatistic[]; error: string | null }> {
  try {
    const stats = await engineGet<BatchStatistic[]>("/batch/statistics?sortBy=startTime&sortOrder=desc&maxResults=50");
    return { stats, error: null };
  } catch (err) {
    return { stats: [], error: err instanceof Error ? err.message : "Failed to load batches" };
  }
}

function progressPct(b: BatchStatistic): number {
  if (b.totalJobs === 0) return 0;
  return Math.round(((b.completedJobs + b.failedJobs) / b.totalJobs) * 100);
}

export default async function BatchesPage() {
  const { stats, error } = await loadBatches();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-muted-foreground text-sm">
            Bulk operations (migration, modification, set-variables, etc.).
          </p>
        </div>
        <Badge variant="secondary">{stats.length} running</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Running batches</CardTitle>
          <CardDescription>
            <code className="bg-muted rounded px-1 text-xs">/batch/statistics</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : stats.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No batches running.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((b) => {
                  const pct = progressPct(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>{b.type}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.totalJobs}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.completedJobs}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.failedJobs > 0 ? <span className="text-destructive font-medium">{b.failedJobs}</span> : 0}
                      </TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2" />
                          <span className="text-muted-foreground text-xs tabular-nums">{pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
