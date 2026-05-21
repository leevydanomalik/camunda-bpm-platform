import { AlertTriangle, ClipboardList, Play, Workflow } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

type CountResponse = { count: number };

async function safeCount(path: string): Promise<number | null> {
  try {
    const res = await engineGet<CountResponse>(path);
    return res.count;
  } catch {
    return null;
  }
}

export default async function CockpitDashboard() {
  const [definitions, instances, incidents, tasks] = await Promise.all([
    safeCount("/process-definition/count?latestVersion=true&active=true"),
    safeCount("/process-instance/count"),
    safeCount("/incident/count"),
    safeCount("/task/count"),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cockpit</h1>
        <p className="text-muted-foreground text-sm">Engine status at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Process definitions"
          value={definitions}
          description="Latest version, active"
          icon={<Workflow className="text-muted-foreground size-4" />}
        />
        <StatCard
          title="Running instances"
          value={instances}
          description="Currently in flight"
          icon={<Play className="text-muted-foreground size-4" />}
        />
        <StatCard
          title="Open incidents"
          value={incidents}
          description="Unresolved"
          icon={<AlertTriangle className="text-muted-foreground size-4" />}
          tone={incidents && incidents > 0 ? "warning" : "default"}
        />
        <StatCard
          title="User tasks"
          value={tasks}
          description="Open across all instances"
          icon={<ClipboardList className="text-muted-foreground size-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process activity</CardTitle>
          <CardDescription>Charts land here next — wired into history/process-instance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            (placeholder)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  tone = "default",
}: {
  title: string;
  value: number | null;
  description: string;
  icon: React.ReactNode;
  tone?: "default" | "warning";
}) {
  const display = value === null ? "—" : new Intl.NumberFormat().format(value);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-semibold ${tone === "warning" && value && value > 0 ? "text-destructive" : ""}`}
        >
          {display}
        </div>
        <p className="text-muted-foreground text-xs">
          {value === null ? "Engine unreachable" : description}
        </p>
      </CardContent>
    </Card>
  );
}
