import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";
import { ExtensionSlot } from "@/lib/plugins/extension-slot";

import { ActiveUsersCard } from "./_components/active-users-card";
import { ActivityTabs } from "./_components/activity-tabs";
import { CockpitQueryProvider } from "./_components/cockpit-query-provider";
import { type CockpitMetrics, DashboardReport } from "./_components/dashboard-report";
import { InstancesTimeseriesCard } from "./_components/instances-timeseries-card";
import { JobStateDonutCard } from "./_components/job-state-donut-card";
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

async function safeCount(path: string): Promise<number> {
  try {
    return (await engineGet<{ count: number }>(path)).count;
  } catch {
    return 0;
  }
}

export default async function CockpitDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  const username = session?.username ?? "user";

  const sp = paramsToSearch(await searchParams);
  const range = parseRange(sp);

  const [running, incidents, tasks, failedJobs, batches, deployments] = await Promise.all([
    safeCount("/process-instance/count"),
    safeCount("/incident/count"),
    safeCount("/task/count"),
    safeCount("/job/count?withException=true&noRetriesLeft=true"),
    safeCount("/batch/count?suspended=false"),
    safeCount("/deployment/count"),
  ]);

  const metrics: CockpitMetrics = { running, incidents, tasks, failedJobs, batches, deployments };
  const asOf = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <DashboardReport username={username} asOf={asOf} rangeKey={range.key} metrics={metrics}>
      <InstancesTimeseriesCard range={range} />

      <div className="grid gap-6 xl:grid-cols-2">
        <JobStateDonutCard />
        <ActiveUsersCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TopDefinitionsBarCard />
        <TopIncidentsBarCard range={range} />
      </div>

      <CockpitQueryProvider>
        <ActivityTabs />
      </CockpitQueryProvider>

      <ExtensionSlot point="cockpit.dashboard.widget" />
    </DashboardReport>
  );
}
