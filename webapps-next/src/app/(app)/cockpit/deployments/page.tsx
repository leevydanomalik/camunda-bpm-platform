import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet } from "@/lib/camunda/engine";

type Deployment = {
  id: string;
  name: string | null;
  source: string | null;
  deploymentTime: string;
  tenantId: string | null;
};

async function loadDeployments(): Promise<{ deployments: Deployment[]; error: string | null }> {
  try {
    const deployments = await engineGet<Deployment[]>(
      "/deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=100",
    );
    return { deployments, error: null };
  } catch (err) {
    return { deployments: [], error: err instanceof Error ? err.message : "Failed to load deployments" };
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

export default async function DeploymentsPage() {
  const { deployments, error } = await loadDeployments();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground text-sm">Newest first, top 100.</p>
        </div>
        <Badge variant="secondary">{deployments.length} total</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All deployments</CardTitle>
          <CardDescription>
            <code className="bg-muted rounded px-1 text-xs">/deployment</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : deployments.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No deployments yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name ?? "(unnamed)"}</TableCell>
                    <TableCell>{d.source ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(d.deploymentTime)}</TableCell>
                    <TableCell>{d.tenantId ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.id}</TableCell>
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
