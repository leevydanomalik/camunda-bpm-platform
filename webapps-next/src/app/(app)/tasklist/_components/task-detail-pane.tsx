import Link from "next/link";

import { Building2, CalendarPlus, ExternalLink, FileText, Layers, MousePointerClick, User } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { engineGet } from "@/lib/camunda/engine";

import { TaskActions } from "./task-actions";
import { type Comment, TaskComments } from "./task-comments";
import { TaskDateEditors } from "./task-date-editors";
import { TaskDiagram } from "./task-diagram";
import { TaskForm } from "./task-form";
import { TaskGenericForm } from "./task-generic-form";
import { type HistoryEvent, TaskHistory } from "./task-history";

type TaskDto = {
  id: string;
  name: string;
  assignee: string | null;
  owner: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  caseInstanceId: string | null;
  taskDefinitionKey: string | null;
  delegationState: string | null;
  description: string | null;
  tenantId: string | null;
};

type Variable = { type: string; value: unknown };
type DeployedForm = Record<string, unknown>;

function processKey(id: string | null): string {
  if (!id) return "—";
  return id.split(":")[0] ?? id;
}

function formatValue(v: Variable): string {
  if (v.value === null || v.value === undefined) return "null";
  if (typeof v.value === "object") return JSON.stringify(v.value);
  return String(v.value);
}

async function loadTask(id: string): Promise<TaskDto | null> {
  try {
    return await engineGet<TaskDto>(`/task/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

async function loadVariables(id: string): Promise<Record<string, Variable>> {
  try {
    return await engineGet<Record<string, Variable>>(`/task/${encodeURIComponent(id)}/variables`);
  } catch {
    return {};
  }
}

async function loadComments(id: string): Promise<Comment[]> {
  try {
    return await engineGet<Comment[]>(`/task/${encodeURIComponent(id)}/comment`);
  } catch {
    return [];
  }
}

async function loadForm(id: string): Promise<DeployedForm | null> {
  try {
    return await engineGet<DeployedForm>(`/task/${encodeURIComponent(id)}/deployed-form`);
  } catch {
    return null;
  }
}

async function loadIdentityLinks(id: string): Promise<{ groups: string[]; users: string[] }> {
  try {
    const links = await engineGet<Array<{ type: string; groupId?: string; userId?: string }>>(
      `/task/${encodeURIComponent(id)}/identity-links`,
    );
    const groups = new Set<string>();
    const users = new Set<string>();
    for (const l of links) {
      if (l.groupId) groups.add(l.groupId);
      if (l.userId && l.type !== "assignee") users.add(l.userId);
    }
    return { groups: [...groups], users: [...users] };
  } catch {
    return { groups: [], users: [] };
  }
}

async function loadProcessXml(definitionId: string | null): Promise<string | null> {
  if (!definitionId) return null;
  try {
    const r = await engineGet<{ bpmn20Xml: string }>(`/process-definition/${encodeURIComponent(definitionId)}/xml`);
    return r.bpmn20Xml ?? null;
  } catch {
    return null;
  }
}

async function loadBusinessKey(processInstanceId: string | null): Promise<string | null> {
  if (!processInstanceId) return null;
  try {
    const pi = await engineGet<{ businessKey: string | null }>(
      `/process-instance/${encodeURIComponent(processInstanceId)}`,
    );
    return pi.businessKey ?? null;
  } catch {
    return null;
  }
}

type IdentityLinkLog = {
  time: string;
  type: "add" | "delete";
  userId?: string | null;
  groupId?: string | null;
  operationType?: string | null;
};
type HistoricDetail = { time: string; variableName?: string | null; type?: string | null };
type HistoricTask = { startTime?: string | null; endTime?: string | null; deleteReason?: string | null };

/** Build the task audit timeline from the engine's history endpoints. */
async function loadHistory(taskId: string): Promise<HistoryEvent[]> {
  const events: HistoryEvent[] = [];
  const q = `taskId=${encodeURIComponent(taskId)}`;

  const [tasks, links, details] = await Promise.all([
    engineGet<HistoricTask[]>(`/history/task?${q}`).catch(() => [] as HistoricTask[]),
    engineGet<IdentityLinkLog[]>(`/history/identity-link-log?${q}`).catch(() => [] as IdentityLinkLog[]),
    engineGet<HistoricDetail[]>(`/history/detail?${q}`).catch(() => [] as HistoricDetail[]),
  ]);

  const t = tasks[0];
  if (t?.startTime) events.push({ time: t.startTime, action: "Created" });
  if (t?.endTime) events.push({ time: t.endTime, action: t.deleteReason === "completed" ? "Completed" : "Ended" });

  for (const l of links) {
    if (!l.time) continue;
    const added = l.type === "add";
    if (l.operationType === "claim" || (l.userId && l.operationType === "setAssignee")) {
      events.push({ time: l.time, action: added ? "Claimed" : "Unclaimed", detail: l.userId ?? null });
    } else if (l.groupId) {
      events.push({
        time: l.time,
        action: added ? "Candidate group added" : "Candidate group removed",
        detail: l.groupId,
      });
    } else if (l.userId) {
      events.push({
        time: l.time,
        action: added ? "Candidate user added" : "Candidate user removed",
        detail: l.userId,
      });
    }
  }

  for (const d of details) {
    if (!d.time) continue;
    if (d.type === "variableUpdate" || d.variableName) {
      events.push({ time: d.time, action: "Variable set", detail: d.variableName ?? null });
    }
  }

  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function TaskDetailEmptyState() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-6">
        <Empty className="h-full border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MousePointerClick className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Pick a task</EmptyTitle>
            <EmptyDescription>
              Select a row from the inbox to inspect variables, comments, the deployed form, and the BPMN diagram.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}

export async function TaskDetailPane({ taskId, username }: { taskId: string; username: string }) {
  const task = await loadTask(taskId);

  if (!task) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 p-6">
          <Empty className="h-full border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Task not found</EmptyTitle>
              <EmptyDescription>
                <code className="bg-muted rounded px-1">{taskId}</code> may have already been completed or removed.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const [variables, comments, form, processXml, identity, businessKey, history] = await Promise.all([
    loadVariables(taskId),
    loadComments(taskId),
    loadForm(taskId),
    loadProcessXml(task.processDefinitionId),
    loadIdentityLinks(taskId),
    loadBusinessKey(task.processInstanceId),
    loadHistory(taskId),
  ]);

  const initialFormData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(variables)) initialFormData[k] = v.value;

  const pKey = processKey(task.processDefinitionId);
  const variableCount = Object.keys(variables).length;
  // Every task gets a Form tab: a deployed form when one exists, otherwise the
  // generic variable form (matches legacy Tasklist). The form owns "Complete".
  const hasForm = true;
  const isAssignedToMe = task.assignee === username;
  const defaultTab = "form";
  const groupsLabel = identity.groups.length > 0 ? identity.groups.join(", ") : null;

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-muted-foreground mb-1 flex items-center gap-2 text-[11px]">
              {task.tenantId ? (
                <span className="border-border inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
                  <Building2 className="size-3" />
                  {task.tenantId}
                </span>
              ) : null}
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono">{pKey}</code>
              {task.processInstanceId ? (
                <Link
                  href={`/cockpit/processes/${encodeURIComponent(pKey)}/instances/${encodeURIComponent(task.processInstanceId)}`}
                  className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  title="Open process instance in Cockpit"
                >
                  open instance
                  <ExternalLink className="size-3" />
                </Link>
              ) : null}
            </div>
            <h2 className="text-2xl leading-tight font-semibold tracking-tight">
              {task.name || task.taskDefinitionKey || task.id}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm italic">{pKey}</p>
            {task.description ? (
              <p className="text-foreground/80 mt-2 max-w-prose text-sm">{task.description}</p>
            ) : null}
          </div>
          <a
            href="#comments"
            className="text-primary/90 hover:text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap"
          >
            <CalendarPlus className="size-3.5" />
            Add Comment
          </a>
        </div>

        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
          <TaskDateEditors taskId={task.id} due={task.due} followUp={task.followUp} />
          {groupsLabel ? (
            <li className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              <span className="text-foreground/80">{groupsLabel}</span>
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <User className="size-3.5" />
            {task.assignee ? (
              <span className={task.assignee === username ? "text-foreground font-medium" : "text-foreground/80"}>
                {task.assignee}
              </span>
            ) : (
              <span className="text-muted-foreground/80">Unassigned</span>
            )}
          </li>
        </ul>

        <TaskActions taskId={task.id} assignee={task.assignee} username={username} hasForm={hasForm} />
      </header>

      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="form">Form</TabsTrigger>
            {processXml ? <TabsTrigger value="diagram">Diagram</TabsTrigger> : null}
            <TabsTrigger value="variables">
              Variables
              <span className="text-muted-foreground/80 ml-1 tabular-nums">{variableCount}</span>
            </TabsTrigger>
            <TabsTrigger value="comments">
              Comments
              <span className="text-muted-foreground/80 ml-1 tabular-nums">{comments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              <span className="text-muted-foreground/80 ml-1 tabular-nums">{history.length}</span>
            </TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="form" className="px-6 py-5">
            {form ? (
              <TaskForm taskId={task.id} schema={form} initialData={initialFormData} />
            ) : (
              <TaskGenericForm
                taskId={task.id}
                businessKey={businessKey}
                initialVariables={variables}
                canComplete={isAssignedToMe}
              />
            )}
          </TabsContent>

          {processXml ? (
            <TabsContent value="diagram" className="px-6 py-5">
              <TaskDiagram xml={processXml} activityId={task.taskDefinitionKey} height={420} />
              {task.taskDefinitionKey ? (
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Highlighted activity: <code className="bg-muted rounded px-1">{task.taskDefinitionKey}</code>
                </p>
              ) : null}
            </TabsContent>
          ) : null}

          <TabsContent value="variables" className="px-6 py-5">
            {variableCount === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                No variables on this task.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8">Name</TableHead>
                      <TableHead className="h-8">Type</TableHead>
                      <TableHead className="h-8">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(variables).map(([name, v]) => (
                      <TableRow key={name}>
                        <TableCell className="py-1.5 font-mono text-xs">{name}</TableCell>
                        <TableCell className="text-muted-foreground py-1.5 text-xs">{v.type}</TableCell>
                        <TableCell className="py-1.5 font-mono text-xs break-all">{formatValue(v)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments" id="comments" className="px-6 py-5">
            <TaskComments taskId={task.id} comments={comments} />
          </TabsContent>

          <TabsContent value="history" className="px-6 py-5">
            <TaskHistory events={history} />
          </TabsContent>

          <TabsContent value="description" className="px-6 py-5">
            {task.description ? (
              <p className="text-foreground/90 max-w-prose text-sm whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                This task has no description.
              </p>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
