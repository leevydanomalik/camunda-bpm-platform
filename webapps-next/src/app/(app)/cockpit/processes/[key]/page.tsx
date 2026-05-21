import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

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

export default async function ProcessDefinitionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
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

  const instances = await loadInstances(def.id);

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
          <Badge variant="secondary">{instances.length} recent instances</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resource</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs">{def.resource}</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deployment</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs">{def.deploymentId}</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tenant</CardTitle>
          </CardHeader>
          <CardContent>{def.tenantId ?? "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Running instances</CardTitle>
          <CardDescription>Latest 50, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {instances.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No running instances.</div>
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
