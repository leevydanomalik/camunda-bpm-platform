import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Task = {
  id: string;
  name: string | null;
  assignee: string | null;
  created: string;
  due: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  taskDefinitionKey: string | null;
};

async function loadTasks(): Promise<{ tasks: Task[]; total: number | null; error: string | null }> {
  try {
    const [tasks, count] = await Promise.all([
      engineGet<Task[]>("/task?sortBy=created&sortOrder=desc&maxResults=50"),
      engineGet<{ count: number }>("/task/count").catch(() => null),
    ]);
    return { tasks, total: count?.count ?? null, error: null };
  } catch (err) {
    return { tasks: [], total: null, error: err instanceof Error ? err.message : "Failed to load tasks" };
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function TasksPage() {
  const { tasks, total, error } = await loadTasks();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">All open user tasks across the engine.</p>
        </div>
        <Badge variant="secondary">{total ?? tasks.length} open</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open tasks</CardTitle>
          <CardDescription>
            Newest first, top 50. <code className="bg-muted rounded px-1 text-xs">/task</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : tasks.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No open tasks.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name ?? t.taskDefinitionKey ?? "(unnamed)"}</TableCell>
                    <TableCell>{t.assignee ?? <span className="text-muted-foreground">unassigned</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(t.created)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(t.due)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.priority}</TableCell>
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
