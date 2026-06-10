import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import type { ActivityBadge } from "@/components/bpmn-viewer";
import { StartProcessButton } from "@/components/start-process-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

import { DiagramCard } from "./_components/diagram-card";

type ActivityStatistic = {
  id: string; // activityId
  instances: number;
  failedJobs: number;
  incidents?: Array<{ incidentType: string; incidentCount: number }>;
};

type ProcessDefinition = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  tenantId: string | null;
  versionTag: string | null;
  resource: string;
  deploymentId: string;
  suspended: boolean;
};

type ProcessInstance = {
  id: string;
  businessKey: string | null;
  definitionId: string;
  startTime?: string;
  state?: string;
  suspended: boolean;
};

async function loadDefinition(key: string): Promise<ProcessDefinition | null> {
  try {
    return await engineGet<ProcessDefinition>(`/process-definition/key/${encodeURIComponent(key)}`);
  } catch {
    return null;
  }
}

async function loadInstances(definitionId: string): Promise<ProcessInstance[]> {
  try {
    return await engineGet<ProcessInstance[]>(
      `/process-instance?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=50&sortBy=startTime&sortOrder=desc`,
    );
  } catch {
    return [];
  }
}

async function loadDiagram(definitionId: string): Promise<string | null> {
  try {
    const res = await engineGet<{ id: string; bpmn20Xml: string }>(
      `/process-definition/${encodeURIComponent(definitionId)}/xml`,
    );
    return res.bpmn20Xml;
  } catch {
    return null;
  }
}

async function loadActivityStatistics(definitionId: string): Promise<ActivityStatistic[]> {
  try {
    return await engineGet<ActivityStatistic[]>(
      `/process-definition/${encodeURIComponent(definitionId)}/statistics?incidents=true`,
    );
  } catch {
    return [];
  }
}

type HistoricActivityInstance = {
  id: string;
  activityId: string;
  activityType: string;
};

/** All-time per-activity counts derived from /history/activity-instance.
 *  v1 caps at maxResults=5000 — switch to a paginated/aggregating endpoint when
 *  this becomes a hot spot. */
async function loadHistoricActivityCounts(definitionId: string): Promise<Record<string, number>> {
  try {
    const items = await engineGet<HistoricActivityInstance[]>(
      `/history/activity-instance?processDefinitionId=${encodeURIComponent(definitionId)}&maxResults=5000`,
    );
    const counts: Record<string, number> = {};
    for (const it of items) {
      if (!it.activityId) continue;
      counts[it.activityId] = (counts[it.activityId] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

function buildBadges(stats: ActivityStatistic[]): ActivityBadge[] {
  const badges: ActivityBadge[] = [];
  for (const s of stats) {
    if (s.instances > 0) {
      badges.push({ elementId: s.id, count: s.instances, tone: "default", position: "bottom-left" });
    }
    const incidentCount = s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0;
    if (incidentCount > 0) {
      badges.push({ elementId: s.id, count: incidentCount, tone: "warning", position: "top-right" });
    }
  }
  return badges;
}

function normalizeToHeatmap(counts: Record<string, number>): Record<string, number> | undefined {
  const max = Object.values(counts).reduce((m, c) => Math.max(m, c), 0);
  if (max === 0) return undefined;
  const heatmap: Record<string, number> = {};
  for (const [id, c] of Object.entries(counts)) {
    if (c > 0) heatmap[id] = c / max;
  }
  return heatmap;
}

function runtimeHeatmap(stats: ActivityStatistic[]): Record<string, number> | undefined {
  const counts: Record<string, number> = {};
  for (const s of stats) counts[s.id] = s.instances;
  return normalizeToHeatmap(counts);
}

export default async function ProcessDefinitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ heat?: string }>;
}) {
  const { key } = await params;
  const { heat } = await searchParams;
  const heatMode: "runtime" | "history" = heat === "history" ? "history" : "runtime";
  const def = await loadDefinition(key);

  if (!def) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cockpit/processes">
            <ArrowLeft className="mr-2 size-4" /> Back to processes
          </Link>
        </Button>
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            No process definition found for key <code className="bg-muted rounded px-1">{key}</code>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [instances, xml, stats, historyCounts] = await Promise.all([
    loadInstances(def.id),
    loadDiagram(def.id),
    loadActivityStatistics(def.id),
    heatMode === "history" ? loadHistoricActivityCounts(def.id) : Promise.resolve({} as Record<string, number>),
  ]);
  const badges = buildBadges(stats);
  const heatmap = heatMode === "history" ? normalizeToHeatmap(historyCounts) : runtimeHeatmap(stats);
  const totalIncidents = stats.reduce(
    (sum, s) => sum + (s.incidents?.reduce((a, b) => a + b.incidentCount, 0) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cockpit/processes">
            <ArrowLeft className="mr-2 size-4" /> Back to processes
          </Link>
        </Button>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{def.name ?? def.key}</h1>
            <p className="text-muted-foreground text-sm">
              <code className="bg-muted rounded px-1">{def.key}</code> · v{def.version}
              {def.versionTag ? ` (${def.versionTag})` : ""}
              {def.suspended ? " · suspended" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{instances.length} recent instances</Badge>
            {totalIncidents > 0 ? <Badge variant="destructive">{totalIncidents} incidents</Badge> : null}
            <StartProcessButton defaultKey={def.key} variant="default" size="sm" />
          </div>
        </div>
      </div>

      {xml ? (
        <DiagramCard
          xml={xml}
          badges={badges}
          heatmap={heatmap}
          heatMode={heatMode}
          processKey={def.key}
          processName={def.name ?? def.key}
        />
      ) : null}

      {/* Compact metadata strip — one divided row instead of three tall cards. */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-1 divide-y p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetaCell label="Resource" value={def.resource} mono />
          <MetaCell label="Deployment" value={def.deploymentId} mono />
          <MetaCell label="Tenant" value={def.tenantId ?? "—"} />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-baseline justify-between gap-2 border-b py-3">
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-sm font-medium">Running instances</CardTitle>
            <span className="text-muted-foreground text-xs tabular-nums">{instances.length}</span>
          </div>
          <CardDescription className="text-xs">Latest 50, newest first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {instances.length === 0 ? (
            <div className="text-muted-foreground px-4 py-3 text-xs">No running instances.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Business key</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/cockpit/processes/${encodeURIComponent(def.key)}/instances/${encodeURIComponent(i.id)}`}
                        className="hover:underline"
                      >
                        {i.id}
                      </Link>
                    </TableCell>
                    <TableCell>{i.businessKey ?? "—"}</TableCell>
                    <TableCell>{i.suspended ? "Suspended" : (i.state ?? "Active")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One compact label/value cell in the metadata strip. */
function MetaCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
      <div className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </div>
    </div>
  );
}
