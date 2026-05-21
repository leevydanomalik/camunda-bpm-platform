import Link from "next/link";

import { AlertTriangle, ArrowLeft } from "lucide-react";

import { BpmnViewer } from "@/components/bpmn-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type ProcessInstance = {
  id: string;
  definitionId: string;
  businessKey: string | null;
  caseInstanceId: string | null;
  ended: boolean;
  suspended: boolean;
  tenantId: string | null;
};

type ActivityInstance = {
  id: string;
  activityId: string;
  activityType: string;
  activityName: string | null;
  childActivityInstances?: ActivityInstance[];
  childTransitionInstances?: { id: string; activityId: string }[];
};

type Variable = { type: string; value: unknown; valueInfo?: Record<string, unknown> };

type Incident = {
  id: string;
  incidentMessage: string | null;
  incidentType: string;
  activityId: string | null;
  incidentTimestamp: string;
};

function flattenActivityIds(node: ActivityInstance | undefined): string[] {
  if (!node) return [];
  const ids: string[] = [];
  if (node.activityId) ids.push(node.activityId);
  for (const child of node.childActivityInstances ?? []) ids.push(...flattenActivityIds(child));
  for (const t of node.childTransitionInstances ?? []) ids.push(t.activityId);
  return ids;
}

async function load(id: string) {
  try {
    const instance = await engineGet<ProcessInstance>(`/process-instance/${encodeURIComponent(id)}`);
    const [xmlRes, variables, incidents, activityTree] = await Promise.all([
      engineGet<{ id: string; bpmn20Xml: string }>(`/process-definition/${encodeURIComponent(instance.definitionId)}/xml`),
      engineGet<Record<string, Variable>>(`/process-instance/${encodeURIComponent(id)}/variables`).catch(() => ({})),
      engineGet<Incident[]>(`/incident?processInstanceId=${encodeURIComponent(id)}`).catch(() => []),
      engineGet<ActivityInstance>(`/process-instance/${encodeURIComponent(id)}/activity-instances`).catch(() => undefined),
    ]);
    return {
      instance,
      xml: xmlRes.bpmn20Xml,
      variables,
      incidents,
      activeActivityIds: Array.from(new Set(flattenActivityIds(activityTree))),
      error: null as string | null,
    };
  } catch (err) {
    return {
      instance: null,
      xml: null,
      variables: {} as Record<string, Variable>,
      incidents: [] as Incident[],
      activeActivityIds: [] as string[],
      error: err instanceof Error ? err.message : "Failed to load instance",
    };
  }
}

function formatValue(v: Variable): string {
  if (v.value === null || v.value === undefined) return "null";
  if (typeof v.value === "object") return JSON.stringify(v.value);
  return String(v.value);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ key: string; id: string }>;
}) {
  const { key, id } = await params;
  const { instance, xml, variables, incidents, activeActivityIds, error } = await load(id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cockpit/processes/${encodeURIComponent(key)}`}>
            <ArrowLeft className="mr-2 size-4" /> Back to definition
          </Link>
        </Button>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Process instance</h1>
            <p className="text-muted-foreground text-sm font-mono">{id}</p>
          </div>
          {instance ? (
            <div className="flex gap-2">
              {instance.suspended ? <Badge variant="secondary">Suspended</Badge> : <Badge>Active</Badge>}
              {incidents.length > 0 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 size-3" /> {incidents.length} incident{incidents.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive p-6 text-sm">{error}</CardContent>
        </Card>
      ) : null}

      {xml ? (
        <Card>
          <CardHeader>
            <CardTitle>Diagram</CardTitle>
            <CardDescription>Active activities highlighted in primary color.</CardDescription>
          </CardHeader>
          <CardContent>
            <BpmnViewer xml={xml} height={420} activityIds={activeActivityIds} />
          </CardContent>
        </Card>
      ) : null}

      {instance ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Business key</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{instance.businessKey ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Definition</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-xs">{instance.definitionId}</code>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tenant</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{instance.tenantId ?? "—"}</CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Variables</CardTitle>
          <CardDescription>Current execution variables.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {Object.keys(variables).length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No variables.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(variables).map(([name, v]) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-xs">{name}</TableCell>
                    <TableCell>{v.type}</TableCell>
                    <TableCell className="font-mono text-xs">{formatValue(v)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>Open incidents on this instance.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No incidents.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(i.incidentTimestamp)}</TableCell>
                    <TableCell className="text-xs">{i.incidentType}</TableCell>
                    <TableCell className="font-mono text-xs">{i.activityId ?? "—"}</TableCell>
                    <TableCell className="text-xs">{i.incidentMessage ?? "—"}</TableCell>
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
