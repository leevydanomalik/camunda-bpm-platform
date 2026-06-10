import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type EngineUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName?: string | null;
  email: string | null;
};

async function loadUsers(): Promise<{ users: EngineUser[]; error: string | null }> {
  try {
    const users = await engineGet<EngineUser[]>("/user");
    return { users, error: null };
  } catch (err) {
    return { users: [], error: err instanceof Error ? err.message : "Failed to load users" };
  }
}

export default async function AdminUsersPage() {
  const { users, error } = await loadUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">
            Identities managed by the Camunda engine (<code className="bg-muted rounded px-1 text-xs">/engine-rest/user</code>).
          </p>
        </div>
        <Badge variant="secondary">{users.length} total</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Read-only for now. Create/edit lands in a later phase.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>First name</TableHead>
                  <TableHead>Last name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell>{u.firstName ?? "—"}</TableCell>
                    <TableCell>{u.lastName ?? "—"}</TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
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
