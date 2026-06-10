import Link from "next/link";

import { Download, FileText, MousePointerClick, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineFetch, engineGet } from "@/lib/camunda/engine";

import { ResourceBpmn, ResourceDmn } from "./resource-diagram";

type ResourceMeta = { id: string; name: string; deploymentId: string };

type ProcessDefinition = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  resource: string;
};

type DecisionDefinition = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  resource: string;
};

type Kind = "bpmn" | "dmn" | "cmmn" | "form" | "code";

function kindOf(filename: string): Kind {
  const f = filename.toLowerCase();
  if (f.endsWith(".bpmn") || f.endsWith(".bpmn20.xml")) return "bpmn";
  if (f.endsWith(".dmn") || f.endsWith(".dmn11.xml") || f.endsWith(".dmn1.xml")) return "dmn";
  if (f.endsWith(".cmmn") || f.endsWith(".cmmn11.xml") || f.endsWith(".cmmn10.xml")) return "cmmn";
  if (f.endsWith(".form")) return "form";
  return "code";
}

function splitPath(name: string): { dir: string; file: string } {
  const idx = name.lastIndexOf("/");
  if (idx < 0) return { dir: "", file: name };
  return { dir: name.slice(0, idx + 1), file: name.slice(idx + 1) };
}

async function loadResource(deploymentId: string, resourceId: string): Promise<ResourceMeta | null> {
  try {
    return await engineGet<ResourceMeta>(
      `/deployment/${encodeURIComponent(deploymentId)}/resources/${encodeURIComponent(resourceId)}`,
    );
  } catch {
    return null;
  }
}

async function loadResourceData(deploymentId: string, resourceId: string): Promise<string | null> {
  try {
    const res = await engineFetch(
      `/deployment/${encodeURIComponent(deploymentId)}/resources/${encodeURIComponent(resourceId)}/data`,
      { method: "GET" },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function loadProcessDefinitions(deploymentId: string): Promise<ProcessDefinition[]> {
  try {
    return await engineGet<ProcessDefinition[]>(`/process-definition?deploymentId=${encodeURIComponent(deploymentId)}`);
  } catch {
    return [];
  }
}

async function loadDecisionDefinitions(deploymentId: string): Promise<DecisionDefinition[]> {
  try {
    return await engineGet<DecisionDefinition[]>(
      `/decision-definition?deploymentId=${encodeURIComponent(deploymentId)}`,
    );
  } catch {
    return [];
  }
}

/** Running process-instance count per definition id (matches Cockpit's "Instance Counts"). */
async function loadProcessInstanceCounts(defs: ProcessDefinition[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    defs.map(async (d) => {
      try {
        const r = await engineGet<{ count: number }>(
          `/process-instance/count?processDefinitionId=${encodeURIComponent(d.id)}`,
        );
        return [d.id, r.count] as const;
      } catch {
        return [d.id, 0] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Historic decision-instance (evaluation) count per definition id. */
async function loadDecisionInstanceCounts(defs: DecisionDefinition[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    defs.map(async (d) => {
      try {
        const r = await engineGet<{ count: number }>(
          `/history/decision-instance/count?decisionDefinitionId=${encodeURIComponent(d.id)}`,
        );
        return [d.id, r.count] as const;
      } catch {
        return [d.id, 0] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function ResourceDetailEmpty({ hasDeployment }: { hasDeployment: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-6">
        <Empty className="h-full border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MousePointerClick className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{hasDeployment ? "Pick a resource" : "Pick a deployment"}</EmptyTitle>
            <EmptyDescription>
              {hasDeployment
                ? "Select a file from the middle pane to inspect its source or diagram."
                : "Select a deployment from the left to browse its resources."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}

export async function ResourceDetail({ deploymentId, resourceId }: { deploymentId: string; resourceId: string }) {
  const meta = await loadResource(deploymentId, resourceId);

  if (!meta) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 p-6">
          <Empty className="h-full border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Resource not found</EmptyTitle>
              <EmptyDescription>
                <code className="bg-muted rounded px-1">{resourceId}</code> may have been removed.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const { file, dir } = splitPath(meta.name);
  const kind = kindOf(file);

  const [content, processDefs, decisionDefs] = await Promise.all([
    loadResourceData(deploymentId, resourceId),
    kind === "bpmn" ? loadProcessDefinitions(deploymentId) : Promise.resolve([] as ProcessDefinition[]),
    kind === "dmn" ? loadDecisionDefinitions(deploymentId) : Promise.resolve([] as DecisionDefinition[]),
  ]);

  // Definitions declared by *this* resource file (a single BPMN/DMN file can
  // hold more than one definition, e.g. a collaboration).
  const resourceProcessDefs = processDefs.filter((p) => p.resource === meta.name);
  const resourceDecisionDefs = decisionDefs.filter((d) => d.resource === meta.name);
  const matchedProcess = resourceProcessDefs[0];
  const matchedDecision = resourceDecisionDefs[0];

  const [processCounts, decisionCounts] = await Promise.all([
    resourceProcessDefs.length > 0 ? loadProcessInstanceCounts(resourceProcessDefs) : Promise.resolve({}),
    resourceDecisionDefs.length > 0 ? loadDecisionInstanceCounts(resourceDecisionDefs) : Promise.resolve({}),
  ]);

  const downloadHref = `/api/engine/deployment/${encodeURIComponent(deploymentId)}/resources/${encodeURIComponent(resourceId)}/data`;

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {dir ? <div className="text-muted-foreground truncate font-mono text-[11px]">{dir}</div> : null}
            <h2 className="text-xl leading-tight font-semibold tracking-tight" title={file}>
              {file}
            </h2>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="border-border bg-background inline-flex items-center rounded border px-1.5 py-0.5 tracking-wider uppercase">
                {kind}
              </span>
              {matchedProcess ? (
                <Badge variant="outline" className="gap-1">
                  <Tag className="size-3" />v{matchedProcess.version}
                  {matchedProcess.versionTag ? ` · ${matchedProcess.versionTag}` : ""}
                </Badge>
              ) : null}
              {matchedDecision ? (
                <Badge variant="outline" className="gap-1">
                  <Tag className="size-3" />v{matchedDecision.version}
                  {matchedDecision.versionTag ? ` · ${matchedDecision.versionTag}` : ""}
                </Badge>
              ) : null}
              <code className="bg-muted rounded px-1 font-mono">{meta.id}</code>
            </div>
          </div>
          <a
            href={downloadHref}
            download={file}
            className="border-border hover:bg-accent inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
          >
            <Download className="size-3.5" />
            Download
          </a>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {content === null ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            Failed to load resource content.
          </div>
        ) : kind === "bpmn" ? (
          <ResourceBpmn xml={content} height={520} />
        ) : kind === "dmn" ? (
          <ResourceDmn xml={content} height={560} />
        ) : (
          <SourceBlock filename={file} content={content} />
        )}

        {resourceProcessDefs.length > 0 ? (
          <DefinitionsTable
            countLabel="Instance Counts"
            rows={resourceProcessDefs.map((d) => ({
              id: d.id,
              key: d.key,
              name: d.name ?? d.key,
              count: processCounts[d.id] ?? 0,
              href: `/cockpit/processes/${encodeURIComponent(d.key)}`,
            }))}
          />
        ) : null}

        {resourceDecisionDefs.length > 0 ? (
          <DefinitionsTable
            countLabel="Evaluations"
            rows={resourceDecisionDefs.map((d) => ({
              id: d.id,
              key: d.key,
              name: d.name ?? d.key,
              count: decisionCounts[d.id] ?? 0,
              href: `/cockpit/decisions/${encodeURIComponent(d.key)}`,
            }))}
          />
        ) : null}
      </div>
    </div>
  );
}

type DefinitionRow = { id: string; key: string; name: string; count: number; href: string };

/** The "Definitions" table Cockpit shows below a deployed resource's diagram. */
function DefinitionsTable({ rows, countLabel }: { rows: DefinitionRow[]; countLabel: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">Definitions</h3>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8">Name</TableHead>
              <TableHead className="h-8">Key</TableHead>
              <TableHead className="h-8 text-right">{countLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-1.5">
                  <Link href={r.href} className="text-primary/90 hover:text-primary font-medium hover:underline">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground py-1.5 font-mono text-xs">{r.key}</TableCell>
                <TableCell className="py-1.5 text-right tabular-nums">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function SourceBlock({ filename, content }: { filename: string; content: string }) {
  const tooLong = content.length > 200_000;
  const display = tooLong ? `${content.slice(0, 200_000)}\n…(truncated, download to view the full file)` : content;
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span>
          {filename} · {content.length.toLocaleString()} bytes
        </span>
        {tooLong ? <span className="text-amber-600 dark:text-amber-400">truncated</span> : null}
      </div>
      <pre className="bg-muted text-foreground max-h-[60vh] overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed">
        {display}
      </pre>
    </div>
  );
}
