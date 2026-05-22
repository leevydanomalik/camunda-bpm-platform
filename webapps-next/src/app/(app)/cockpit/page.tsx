import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

import { CockpitQueryProvider } from "./_components/cockpit-query-provider";
import { DashboardHeader } from "./_components/dashboard-header";
import { InstancesTimeseriesCard } from "./_components/instances-timeseries-card";
import { JobStateDonutCard } from "./_components/job-state-donut-card";
import { KpiGrid } from "./_components/kpi-grid";
import { parseRange } from "./_components/range";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function paramsToSearch(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value) && value[0]) sp.set(key, value[0]);
  }
  return sp;
}

export default async function CockpitDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  const username = session?.username ?? "user";

  const sp = paramsToSearch(await searchParams);
  const range = parseRange(sp);

  return (
    <div className="space-y-6">
      <DashboardHeader username={username} range={range.key} />

      <KpiGrid range={range} />

      {/* Primary charts row — replaced in Tasks 6 & 7 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <InstancesTimeseriesCard range={range} />
        <JobStateDonutCard />
      </div>

      {/* Secondary charts row — replaced in Tasks 8 & 9 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderCard title="Top process definitions (Task 8)" height="h-64" />
        <PlaceholderCard title="Top incident types (Task 9)" height="h-64" />
      </div>

      {/* Activity tabs + plugin sidebar — replaced in Task 11 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CockpitQueryProvider>
          <PlaceholderCard title="Activity tabs (Task 11)" height="h-72" />
        </CockpitQueryProvider>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom widgets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExtensionSlot point="cockpit.dashboard.widget" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, height, className }: { title: string; height: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-muted-foreground bg-muted/30 flex ${height} items-center justify-center rounded text-xs`}>
          (placeholder)
        </div>
      </CardContent>
    </Card>
  );
}
