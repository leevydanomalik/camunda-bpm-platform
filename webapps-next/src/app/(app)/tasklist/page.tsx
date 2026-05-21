import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

// v1 subset of Camunda's TaskDto — promote to src/lib/camunda/tasks.ts when
// claim/complete actions arrive in a follow-up phase.
type TaskDto = {
  id: string;
  name: string;
  assignee: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
};

async function safeTasks(username: string): Promise<{ tasks: TaskDto[] | null; error: string | null }> {
  try {
    const tasks = await engineGet<TaskDto[]>(
      `/task?assignee=${encodeURIComponent(username)}&sortBy=created&sortOrder=desc&maxResults=50`,
    );
    return { tasks, error: null };
  } catch (err) {
    return { tasks: null, error: err instanceof Error ? err.message : "Engine unreachable" };
  }
}

function processKey(id: string | null): string {
  if (!id) return "—";
  return id.split(":")[0] ?? id;
}

function relative(iso: string): string {
  try {
    return `${formatDistanceToNow(new Date(iso))} ago`;
  } catch {
    return iso;
  }
}

function absolute(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function TasklistPage() {
  const session = await getSession();
  const username = session?.username ?? "guest";
  const { tasks, error } = await safeTasks(username);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tasklist</h1>
        <p className="text-muted-foreground text-sm">Your open user tasks</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Assignee: {username}</Badge>
        {tasks ? <Badge variant="outline">{tasks.length} task{tasks.length === 1 ? "" : "s"}</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            <code className="bg-muted rounded px-1 text-xs">
              /task?assignee={username}&sortBy=created&maxResults=50
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tasks === null ? (
            <div className="text-muted-foreground p-8 text-center text-sm">Engine unreachable{error ? `: ${error}` : ""}.</div>
          ) : tasks.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">No tasks assigned to you.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Process</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{processKey(t.processDefinitionId)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{relative(t.created)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{absolute(t.due)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.priority}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled>
                        Open
                      </Button>
                    </TableCell>
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
