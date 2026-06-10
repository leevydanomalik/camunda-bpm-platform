"use client";

import { type ReactNode, useMemo } from "react";

import Link from "next/link";

import {
  AiBadge,
  type AiBundle,
  ExecutiveReport,
  type Insight,
  InsightsCard,
  type KeyFigure,
  type Recommendation,
  RecommendationsCard,
  useAiInsights,
} from "@/components/report/executive-report";

export type CockpitMetrics = {
  running: number;
  incidents: number;
  tasks: number;
  failedJobs: number;
  batches: number;
  deployments: number;
};

const RANGES = ["7d", "30d", "90d"] as const;

function RangeToggle({ active }: { active: string }) {
  return (
    <div className="no-print bg-muted text-muted-foreground inline-flex items-center rounded-full p-0.5 text-xs">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/cockpit?range=${r}`}
          className={`rounded-full px-3 py-1 font-medium ${
            active === r ? "bg-primary text-primary-foreground shadow-sm" : "hover:text-foreground"
          }`}
        >
          {r.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export function DashboardReport({
  username,
  asOf,
  rangeKey,
  metrics,
  children,
}: {
  username: string;
  asOf: string;
  rangeKey: string;
  metrics: CockpitMetrics;
  children: ReactNode;
}) {
  const { running, incidents, tasks, failedJobs, batches, deployments } = metrics;

  const keyFigures: KeyFigure[] = [
    { label: "Running instances", value: running, hint: "in flight" },
    { label: "Open incidents", value: incidents, hint: incidents > 0 ? "needs attention" : "all clear" },
    { label: "Open user tasks", value: tasks, hint: "awaiting action" },
    { label: "Failed jobs", value: failedJobs, hint: failedJobs > 0 ? "no retries left" : "none" },
    { label: "Active batches", value: batches, hint: "running" },
    { label: "Deployments", value: deployments, hint: "total" },
  ];

  // Deterministic fallback — DeepSeek gets the live snapshot; this narrates if it's down.
  const fallback: AiBundle = useMemo(() => {
    const insights: Insight[] = [
      {
        tone: "neutral",
        title: `${running} instances in flight`,
        detail: `${running} process instance${running === 1 ? "" : "s"} running across ${deployments} deployment${deployments === 1 ? "" : "s"}.`,
      },
      {
        tone: "neutral",
        title: `${tasks} open user tasks`,
        detail: `${tasks} task${tasks === 1 ? "" : "s"} are waiting to be claimed or completed.`,
      },
      incidents > 0
        ? {
            tone: "critical",
            title: `${incidents} open incident${incidents === 1 ? "" : "s"}`,
            detail: "Incidents indicate stuck or failing executions that need investigation.",
          }
        : { tone: "positive", title: "No open incidents", detail: "All running executions are healthy right now." },
      failedJobs > 0
        ? {
            tone: "warning",
            title: `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}`,
            detail: "Jobs with no retries left are blocking their instances.",
          }
        : { tone: "positive", title: "No failed jobs", detail: "The job executor has no exhausted-retry failures." },
    ];

    const recommendations: Recommendation[] = [];
    if (incidents > 0)
      recommendations.push({
        priority: "High",
        text: `Investigate the ${incidents} open incident${incidents === 1 ? "" : "s"} and resolve the root cause before retrying.`,
      });
    if (failedJobs > 0)
      recommendations.push({
        priority: "High",
        text: `Inspect and re-trigger the ${failedJobs} failed job${failedJobs === 1 ? "" : "s"} once the underlying error is fixed.`,
      });
    if (tasks > 15)
      recommendations.push({
        priority: "Medium",
        text: `${tasks} user tasks are open — check assignment and SLA to avoid a backlog.`,
      });
    recommendations.push({
      priority: "Low",
      text: "Keep an eye on instance-start volume across the selected range for unusual spikes or drops.",
    });

    const summary = `${running} process instance${running === 1 ? " is" : "s are"} running across ${deployments} deployment${deployments === 1 ? "" : "s"}, with ${tasks} open user task${tasks === 1 ? "" : "s"} awaiting action. ${
      incidents > 0 ? `${incidents} open incident${incidents === 1 ? "" : "s"} ` : "No open incidents "
    }and ${failedJobs > 0 ? `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}` : "no failed jobs"} right now.`;

    return { summary, insights, recommendations };
  }, [running, incidents, tasks, failedJobs, deployments]);

  const ai = useAiInsights("cockpit-overview", metrics as unknown as Record<string, unknown>, fallback, {
    focus: "running instance volume, open incidents, failed jobs, open user tasks, and deployment footprint",
    context: "a Camunda 7 process-orchestration engine operations dashboard",
  });

  const csv = {
    filename: "cockpit-overview.csv",
    headers: ["Metric", "Value"],
    rows: keyFigures.map((f) => [f.label, f.value]),
  };

  return (
    <ExecutiveReport
      eyebrow="Cockpit Operations"
      title="Operations Overview"
      subtitle={`Live process orchestration across the engine — welcome back, ${username}.`}
      meta={{ asOf, preparedFor: "Operations" }}
      csv={csv}
      pdfTitle="Cockpit Operations Overview"
      actions={<RangeToggle active={rangeKey} />}
      summary={ai.summary}
      summaryBadge={<AiBadge source={ai.source} loading={ai.loading} />}
      keyFigures={keyFigures}
      aside={
        <>
          <InsightsCard insights={ai.insights} badge={<AiBadge source={ai.source} loading={ai.loading} />} />
          <RecommendationsCard items={ai.recommendations} />
        </>
      }
    >
      {children}
    </ExecutiveReport>
  );
}
