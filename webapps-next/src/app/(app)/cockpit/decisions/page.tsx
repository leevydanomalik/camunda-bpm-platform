import { Badge } from "@/components/ui/badge";
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
  decisionRequirementsDefinitionKey: string | null;
};

async function loadDefinitions(): Promise<{ defs: DecisionDefinition[]; error: string | null }> {
  try {
    const defs = await engineGet<DecisionDefinition[]>(
      "/decision-definition?latestVersion=true&sortBy=name&sortOrder=asc",
    );
    return { defs, error: null };
  } catch (err) {
    return { defs: [], error: err instanceof Error ? err.message : "Failed to load decision definitions" };
  }
}

export default async function DecisionsPage() {
  const { defs, error } = await loadDefinitions();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
          <p className="text-muted-foreground text-sm">
            DMN decision definitions, latest versions only.
          </p>
        </div>
        <Badge variant="secondary">{defs.length} definitions</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Decision definitions</CardTitle>
          <CardDescription>
            <code className="bg-muted rounded px-1 text-xs">/decision-definition?latestVersion=true</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="text-destructive p-6 text-sm">Failed to load: {error}</div>
          ) : defs.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">No decision definitions deployed.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>DRD</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead>Tenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name ?? d.key}</TableCell>
                    <TableCell className="font-mono text-xs">{d.key}</TableCell>
                    <TableCell className="font-mono text-xs">{d.decisionRequirementsDefinitionKey ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {d.version}
                      {d.versionTag ? (
                        <span className="text-muted-foreground ml-1 text-xs">({d.versionTag})</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{d.tenantId ?? "—"}</TableCell>
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
