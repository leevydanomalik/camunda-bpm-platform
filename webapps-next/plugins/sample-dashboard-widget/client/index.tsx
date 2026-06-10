import { PackageOpen } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

type Deployment = {
  id: string;
  name: string | null;
  source: string | null;
  deploymentTime: string;
};

async function recent(): Promise<Deployment[]> {
  try {
    return await engineGet<Deployment[]>("/deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=3");
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export async function RecentDeploymentsWidget() {
  const deployments = await recent();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Recent deployments</CardTitle>
          <CardDescription className="text-xs">
            via plugin <code className="bg-muted rounded px-1">sample-dashboard-widget</code>
          </CardDescription>
        </div>
        <PackageOpen className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="space-y-2">
        {deployments.length === 0 ? (
          <p className="text-muted-foreground text-xs">None yet.</p>
        ) : (
          deployments.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium">{d.name ?? "(unnamed)"}</span>
              <span className="text-muted-foreground whitespace-nowrap">{formatDate(d.deploymentTime)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
