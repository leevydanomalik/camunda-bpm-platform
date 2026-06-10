import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

// Camunda auth type: 0 = global, 1 = grant, 2 = revoke
const AUTH_TYPE_LABEL: Record<number, { label: string; tone: "default" | "secondary" | "destructive" }> = {
  0: { label: "Global", tone: "secondary" },
  1: { label: "Grant", tone: "default" },
  2: { label: "Revoke", tone: "destructive" },
};

type Authorization = {
  id: string;
  type: number;
  permissions: string[];
  userId: string | null;
  groupId: string | null;
  resourceType: number;
  resourceId: string | null;
  removalTime: string | null;
  rootProcessInstanceId: string | null;
};

async function loadAuths(): Promise<{ auths: Authorization[]; error: string | null }> {
  try {
    const auths = await engineGet<Authorization[]>("/authorization?sortBy=resourceType&sortOrder=asc&maxResults=200");
    return { auths, error: null };
  } catch (err) {
    return { auths: [], error: err instanceof Error ? err.message : "Failed to load authorizations" };
  }
}

export default async function AdminAuthorizationsPage() {
  const { auths, error } = await loadAuths();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Authorizations</h1>
          <p className="text-muted-foreground text-sm">
            Permissions per user/group on engine resources (
            <code className="bg-muted rounded px-1 text-xs">/engine-rest/authorization</code>).
          </p>
        </div>
        <Badge variant="secondary">{auths.length} total</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All authorizations</CardTitle>
          <CardDescription>Read-only for now.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : auths.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No authorizations defined.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Resource type</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auths.map((a) => {
                  const typeMeta = AUTH_TYPE_LABEL[a.type] ?? { label: `Type ${a.type}`, tone: "secondary" as const };
                  const subject = a.userId
                    ? `User: ${a.userId}`
                    : a.groupId
                      ? `Group: ${a.groupId}`
                      : "—";
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge variant={typeMeta.tone}>{typeMeta.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{subject}</TableCell>
                      <TableCell className="tabular-nums">{a.resourceType}</TableCell>
                      <TableCell className="font-mono text-xs">{a.resourceId ?? "—"}</TableCell>
                      <TableCell className="text-xs">{a.permissions.join(", ") || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
