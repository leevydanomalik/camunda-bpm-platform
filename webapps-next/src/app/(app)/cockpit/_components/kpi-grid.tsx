import { AlertTriangle, ClipboardList, Layers, Package, Play, XCircle } from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";

import { KpiCard, type KpiDelta } from "./kpi-card";
import { previousPeriod, type Range } from "./range";

type Count = { count: number };

async function safeCount(path: string): Promise<number | null> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return null;
  }
}

function isoNoMs(d: Date): string {
  // engine-rest accepts ISO 8601; strip milliseconds to keep URLs short.
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

async function safeDelta(
  historyPath: (from: string, to: string) => string,
  range: Range,
  label: string,
): Promise<KpiDelta | undefined> {
  const prev = previousPeriod(range);
  const [current, previous] = await Promise.all([
    safeCount(historyPath(isoNoMs(range.from), isoNoMs(range.to))),
    safeCount(historyPath(isoNoMs(prev.from), isoNoMs(prev.to))),
  ]);
  if (current === null || previous === null) return undefined;
  return { value: current - previous, label };
}

export async function KpiGrid({ range }: { range: Range }) {
  const deltaLabel = `vs. last ${range.key === "custom" ? "period" : range.key}`;

  const [
    runningInstances,
    openIncidents,
    openTasks,
    failedJobs,
    activeBatches,
    deployments,
    incidentsDelta,
    deploymentsDelta,
    instancesStartedDelta,
    tasksCompletedDelta,
  ] = await Promise.all([
    safeCount("/process-instance/count"),
    safeCount("/incident/count"),
    safeCount("/task/count"),
    safeCount("/job/count?withException=true&noRetriesLeft=true"),
    safeCount("/batch/count?suspended=false"),
    safeCount("/deployment/count"),
    safeDelta(
      (from, to) => `/history/incident/count?createTimeAfter=${from}&createTimeBefore=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta(
      // /deployment supports `after` / `before` filters on deploymentTime;
      // there is no /history/deployment endpoint in engine-rest.
      (from, to) => `/deployment/count?after=${from}&before=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta(
      (from, to) => `/history/process-instance/count?startedAfter=${from}&startedBefore=${to}`,
      range,
      deltaLabel,
    ),
    safeDelta((from, to) => `/history/task/count?finishedAfter=${from}&finishedBefore=${to}`, range, deltaLabel),
  ]);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        href="/cockpit/processes"
        icon={<Play className="size-4" />}
        label="Running instances"
        value={runningInstances}
        delta={instancesStartedDelta}
      />
      <KpiCard
        href="/cockpit/processes"
        icon={<AlertTriangle className="size-4" />}
        label="Open incidents"
        value={openIncidents}
        tone="warning"
        delta={incidentsDelta}
      />
      <KpiCard
        href="/cockpit/tasks"
        icon={<ClipboardList className="size-4" />}
        label="Open user tasks"
        value={openTasks}
        delta={tasksCompletedDelta}
      />
      <KpiCard
        href="/cockpit/processes"
        icon={<XCircle className="size-4" />}
        label="Failed jobs"
        value={failedJobs}
        tone="warning"
      />
      <KpiCard
        href="/cockpit/batches"
        icon={<Layers className="size-4" />}
        label="Active batches"
        value={activeBatches}
      />
      <KpiCard
        href="/cockpit/deployments"
        icon={<Package className="size-4" />}
        label="Deployments"
        value={deployments}
        delta={deploymentsDelta}
      />
    </div>
  );
}
