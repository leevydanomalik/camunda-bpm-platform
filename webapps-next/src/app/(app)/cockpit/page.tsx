import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

import { ActivityTabs } from "./_components/activity-tabs";
import { CockpitQueryProvider } from "./_components/cockpit-query-provider";
import { DashboardHeader } from "./_components/dashboard-header";
import { InstancesTimeseriesCard } from "./_components/instances-timeseries-card";
import { JobStateDonutCard } from "./_components/job-state-donut-card";
import { KpiGrid } from "./_components/kpi-grid";
import { parseRange } from "./_components/range";
import { TopDefinitionsBarCard } from "./_components/top-definitions-bar-card";
import { TopIncidentsBarCard } from "./_components/top-incidents-bar-card";

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

      <div className="grid gap-4 lg:grid-cols-3">
        <InstancesTimeseriesCard range={range} />
        <JobStateDonutCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopDefinitionsBarCard />
        <TopIncidentsBarCard range={range} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CockpitQueryProvider>
          <ActivityTabs />
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
