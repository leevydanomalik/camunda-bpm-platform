import Link from "next/link";

import { Bell, Building2, CalendarPlus, ExternalLink, FileText, Layers, MousePointerClick, User } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { engineGet } from "@/lib/camunda/engine";

import { TaskActions } from "./task-actions";
import { type Comment, TaskComments } from "./task-comments";
import { TaskDiagram } from "./task-diagram";
import { TaskForm } from "./task-form";

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

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const future = diffMs > 0;
  const absDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);
  if (absDays < 1) {
    const hours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(absDays);
  return future ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
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

  const [variables, comments, form, processXml, identity] = await Promise.all([
    loadVariables(taskId),
    loadComments(taskId),
    loadForm(taskId),
    loadProcessXml(task.processDefinitionId),
    loadIdentityLinks(taskId),
  ]);

  const initialFormData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(variables)) initialFormData[k] = v.value;

  const pKey = processKey(task.processDefinitionId);
  const variableCount = Object.keys(variables).length;
  const defaultTab = form ? "form" : processXml ? "diagram" : "variables";
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
          <li className="inline-flex items-center gap-1.5">
            <CalendarPlus className="size-3.5" />
            <span>
              {task.followUp ? (
                <>
                  Follow-up <span className="text-foreground/80">{relativeDate(task.followUp)}</span>
                </>
              ) : (
                <span className="text-muted-foreground/80">Set follow-up date</span>
              )}
            </span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Bell className="size-3.5" />
            <span>
              {task.due ? (
                <>
                  Due <span className="text-foreground/80">{relativeDate(task.due)}</span>
                </>
              ) : (
                <span className="text-muted-foreground/80">No due date</span>
              )}
            </span>
          </li>
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

        <TaskActions taskId={task.id} assignee={task.assignee} username={username} hasForm={Boolean(form)} />
      </header>

      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <div className="bg-background px-6 pt-3">
          <TabsList>
            {form ? <TabsTrigger value="form">Form</TabsTrigger> : null}
            {processXml ? <TabsTrigger value="diagram">Diagram</TabsTrigger> : null}
            <TabsTrigger value="variables">
              Variables
              <span className="text-muted-foreground/80 ml-1 tabular-nums">{variableCount}</span>
            </TabsTrigger>
            <TabsTrigger value="comments">
              Comments
              <span className="text-muted-foreground/80 ml-1 tabular-nums">{comments.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {form ? (
            <TabsContent value="form" className="px-6 py-5">
              <TaskForm taskId={task.id} schema={form} initialData={initialFormData} />
            </TabsContent>
          ) : null}

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
        </div>
      </Tabs>
    </div>
  );
}
