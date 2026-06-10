import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type JobDto = {
  id: string;
  jobDefinitionId: string;
  exceptionMessage: string | null;
  dueDate: string | null;
  processInstanceId: string | null;
  processDefinitionId: string | null;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<JobDto[]>(
      "/job?withException=true&noRetriesLeft=true&sortBy=jobDueDate&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.exceptionMessage ?? "Job failed",
      subtitle: d.jobDefinitionId,
      timestamp: d.dueDate ?? undefined,
      tone: "warning",
      href:
        d.processDefinitionId && d.processInstanceId
          ? `/cockpit/processes/${encodeURIComponent(d.processDefinitionId)}/instances/${encodeURIComponent(d.processInstanceId)}`
          : undefined,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
