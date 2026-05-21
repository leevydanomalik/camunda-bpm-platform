import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Group = {
  id: string;
  name: string | null;
  type: string | null;
};

async function loadGroups(): Promise<{ groups: Group[]; error: string | null }> {
  try {
    const groups = await engineGet<Group[]>("/group?sortBy=id&sortOrder=asc&maxResults=200");
    return { groups, error: null };
  } catch (err) {
    return { groups: [], error: err instanceof Error ? err.message : "Failed to load groups" };
  }
}

export default async function AdminGroupsPage() {
  const { groups, error } = await loadGroups();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-muted-foreground text-sm">
            Identity groups managed by the engine (<code className="bg-muted rounded px-1 text-xs">/engine-rest/group</code>).
          </p>
        </div>
        <Badge variant="secondary">{groups.length} total</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All groups</CardTitle>
          <CardDescription>Read-only for now.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : groups.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No groups defined.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs">{g.id}</TableCell>
                    <TableCell>{g.name ?? "—"}</TableCell>
                    <TableCell>{g.type ?? "—"}</TableCell>
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
