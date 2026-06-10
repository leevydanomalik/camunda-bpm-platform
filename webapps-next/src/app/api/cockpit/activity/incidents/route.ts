import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type IncidentDto = {
  id: string;
  incidentType: string;
  incidentMessage: string | null;
  incidentTimestamp: string;
  processDefinitionId: string;
  processInstanceId: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<IncidentDto[]>("/incident?sortBy=incidentTimestamp&sortOrder=desc&maxResults=10");
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.incidentType,
      subtitle: d.incidentMessage ?? undefined,
      timestamp: d.incidentTimestamp,
      tone: "warning",
      href: `/cockpit/processes/${encodeURIComponent(d.processDefinitionId)}/instances/${encodeURIComponent(d.processInstanceId)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
