import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

// Statistics endpoint returns definitions + instance/incident counts in one call,
// avoiding the N+1 problem of fetching counts per definition.
type DefinitionStatistic = {
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

async function loadStatistics(): Promise<{ stats: DefinitionStatistic[]; error: string | null }> {
  try {
    const stats = await engineGet<DefinitionStatistic[]>("/process-definition/statistics?incidents=true");
    return { stats, error: null };
  } catch (err) {
    return { stats: [], error: err instanceof Error ? err.message : "Failed to load process definitions" };
  }
}

export default async function ProcessesPage() {
  const { stats, error } = await loadStatistics();

  const totalIncidents = stats.reduce(
    (sum, s) => sum + (s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Processes</h1>
          <p className="text-muted-foreground text-sm">
            All deployed process definitions, latest versions only.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{stats.length} definitions</Badge>
          {totalIncidents > 0 ? <Badge variant="destructive">{totalIncidents} incidents</Badge> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process definitions</CardTitle>
          <CardDescription>
            <code className="bg-muted rounded px-1 text-xs">/process-definition/statistics?incidents=true</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : stats.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No process definitions deployed yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Running</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s) => {
                  const incidentCount = s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/cockpit/processes/${encodeURIComponent(s.definition.key)}`}
                          className="hover:underline"
                        >
                          {s.definition.name ?? s.definition.key}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.definition.key}</TableCell>
                      <TableCell className="text-right">
                        {s.definition.version}
                        {s.definition.versionTag ? (
                          <span className="text-muted-foreground ml-1 text-xs">({s.definition.versionTag})</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{s.definition.tenantId ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.instances}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {incidentCount > 0 ? (
                          <span className="text-destructive font-medium">{incidentCount}</span>
                        ) : (
                          0
                        )}
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
