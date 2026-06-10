import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { DmnViewer } from "@/components/dmn-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type DecisionDefinition = {
  id: string;
  key: string;
  name: string | null;
  category: string | null;
  version: number;
  tenantId: string | null;
  versionTag: string | null;
  resource: string;
  deploymentId: string;
  decisionRequirementsDefinitionId: string | null;
  decisionRequirementsDefinitionKey: string | null;
};

type HistoricDecisionInstance = {
  id: string;
  decisionDefinitionId: string;
  decisionDefinitionKey: string;
  decisionDefinitionName: string | null;
  evaluationTime: string;
  removalTime: string | null;
  rootDecisionInstanceId: string | null;
  rootProcessInstanceId: string | null;
};

async function loadDefinition(key: string): Promise<DecisionDefinition | null> {
  try {
    return await engineGet<DecisionDefinition>(`/decision-definition/key/${encodeURIComponent(key)}`);
  } catch {
    return null;
  }
}

async function loadXml(id: string): Promise<string | null> {
  try {
    const res = await engineGet<{ id: string; dmnXml: string }>(`/decision-definition/${encodeURIComponent(id)}/xml`);
    return res.dmnXml;
  } catch {
    return null;
  }
}

async function loadHistory(id: string): Promise<HistoricDecisionInstance[]> {
  try {
    return await engineGet<HistoricDecisionInstance[]>(
      `/history/decision-instance?decisionDefinitionId=${encodeURIComponent(id)}&sortBy=evaluationTime&sortOrder=desc&maxResults=20`,
    );
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function DecisionDefinitionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const def = await loadDefinition(key);

  if (!def) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cockpit/decisions">
            <ArrowLeft className="mr-2 size-4" /> Back to decisions
          </Link>
        </Button>
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            No decision definition found for key <code className="bg-muted rounded px-1">{key}</code>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [xml, history] = await Promise.all([loadXml(def.id), loadHistory(def.id)]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cockpit/decisions">
            <ArrowLeft className="mr-2 size-4" /> Back to decisions
          </Link>
        </Button>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{def.name ?? def.key}</h1>
            <p className="text-muted-foreground text-sm">
              <code className="bg-muted rounded px-1">{def.key}</code> · v{def.version}
              {def.versionTag ? ` (${def.versionTag})` : ""}
            </p>
          </div>
          <Badge variant="secondary">{history.length} recent evaluations</Badge>
        </div>
      </div>

      {xml ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              Auto-rendered by dmn-js — DRD, decision table, or literal expression based on the DMN root type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DmnViewer xml={xml} height={480} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">DMN XML unavailable.</CardContent>
        </Card>
      )}

      {/* Compact metadata strip — one divided row instead of three tall cards. */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-1 divide-y p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetaCell label="Resource" value={def.resource} mono />
          <MetaCell label="Deployment" value={def.deploymentId} mono />
          <MetaCell label="DRD" value={def.decisionRequirementsDefinitionKey ?? "—"} mono />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-baseline justify-between gap-2 border-b py-3">
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-sm font-medium">Recent evaluations</CardTitle>
            <span className="text-muted-foreground text-xs tabular-nums">{history.length}</span>
          </div>
          <CardDescription className="text-xs">Top 20, newest first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="text-muted-foreground px-4 py-3 text-xs">No evaluations recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Root process</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(h.evaluationTime)}</TableCell>
                    <TableCell className="font-mono text-xs">{h.id}</TableCell>
                    <TableCell className="font-mono text-xs">{h.rootProcessInstanceId ?? "—"}</TableCell>
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
